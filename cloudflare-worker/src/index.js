/**
 * Publicación automática de Reels con la API de Meta + Cloudflare Workers + R2
 * (capítulo 09, "Publier tout seul avec Cloudflare"). OPCIONAL.
 *
 * Funcionamiento:
 *  - Los vídeos se suben al bucket R2 (carpeta "videos/").
 *  - La cola es el archivo "cola.json" en el mismo bucket: una lista de posts.
 *  - Cada 5 minutos (cron) el Worker busca posts cuya hora ya llegó y que estén APROBADOS.
 *  - Crea un enlace temporal firmado al vídeo, se lo pasa a Instagram, espera el
 *    procesado, publica, borra el vídeo de R2 y te avisa por ntfy.
 *
 * Formato de cola.json:
 * [
 *   {
 *     "id": "2026-11-24-createurs",
 *     "video": "videos/2026-11-24_opinion_createurs-nuls.mp4",
 *     "caption": "Les créateurs de contenu sont nuls ? 😤 ...",
 *     "publicar_en": "2026-11-24T18:00:00+01:00",
 *     "aprobado": true,              // ← sin esto NO se publica nunca (regla del capítulo 10)
 *     "trial": false,                // true = trial reel (solo a no seguidores)
 *     "estado": "pendiente"          // el Worker lo cambia a "publicado" o "error"
 *   }
 * ]
 *
 * Secretos (wrangler secret put ...), nunca en el código:
 *   META_TOKEN      token del usuario del sistema (paso 9)
 *   IG_USER_ID      identificador de la cuenta de Instagram (paso 10)
 *   LINK_SECRET     cadena aleatoria larga para firmar los enlaces temporales
 *   NTFY_TOPIC      tema ntfy
 */

const COLA = 'cola.json';

export default {
  // Sirve el vídeo a Instagram mediante un enlace temporal firmado
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/video') return new Response('Not found', { status: 404 });

    const key = url.searchParams.get('k') || '';
    const exp = Number(url.searchParams.get('exp') || 0);
    const sig = url.searchParams.get('sig') || '';
    if (!key.startsWith('videos/') || Date.now() / 1000 > exp) {
      return new Response('Expirado', { status: 403 });
    }
    if (sig !== (await firmar(env.LINK_SECRET, `${key}:${exp}`))) {
      return new Response('Firma inválida', { status: 403 });
    }
    const obj = await env.BUCKET.get(key);
    if (!obj) return new Response('No existe', { status: 404 });
    return new Response(obj.body, {
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(obj.size) },
    });
  },

  // Cron cada 5 minutos
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(procesarCola(env));
  },
};

async function procesarCola(env) {
  const objCola = await env.BUCKET.get(COLA);
  if (!objCola) return;
  const cola = await objCola.json();
  const ahora = Date.now();
  let cambios = false;

  for (const post of cola) {
    if (post.estado !== 'pendiente') continue;
    if (post.aprobado !== true) continue;                 // sin luz verde, nada sale
    if (new Date(post.publicar_en).getTime() > ahora) continue;

    try {
      const mediaId = await publicarReel(env, post);
      post.estado = 'publicado';
      post.media_id = mediaId;
      post.publicado_el = new Date().toISOString();
      await env.BUCKET.delete(post.video);
      await notificar(env, '✅ Reel publié', post.id);
    } catch (err) {
      post.estado = 'error';
      post.error = String(err.message || err).slice(0, 500);
      await notificar(env, '❌ Erreur publication', `${post.id}: ${post.error}`);
    }
    cambios = true;
    break; // un post por pasada: ritmo prudente para no alertar a Meta
  }

  if (cambios) {
    await env.BUCKET.put(COLA, JSON.stringify(cola, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  }
}

async function publicarReel(env, post) {
  const graph = `https://graph.facebook.com/${env.GRAPH_VERSION}`;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // enlace válido 1 hora
  const sig = await firmar(env.LINK_SECRET, `${post.video}:${exp}`);
  const videoUrl =
    `${env.PUBLIC_URL}/video?k=${encodeURIComponent(post.video)}&exp=${exp}&sig=${sig}`;

  // 1. Crear el contenedor (vídeo + caption)
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: post.caption || '',
    access_token: env.META_TOKEN,
  });
  if (post.trial) {
    params.set('trial_params', JSON.stringify({ graduation_strategy: 'MANUAL' }));
  }
  const cont = await llamar(`${graph}/${env.IG_USER_ID}/media`, params);

  // 2. Esperar a que Instagram procese el vídeo (máx. ~4 min dentro del Worker)
  for (let i = 0; i < 24; i++) {
    await dormir(10_000);
    const r = await fetch(
      `${graph}/${cont.id}?fields=status_code,status&access_token=${env.META_TOKEN}`,
    );
    const s = await r.json();
    if (s.status_code === 'FINISHED') {
      // 3. Publicar
      const pub = await llamar(
        `${graph}/${env.IG_USER_ID}/media_publish`,
        new URLSearchParams({ creation_id: cont.id, access_token: env.META_TOKEN }),
      );
      return pub.id;
    }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error(`Instagram no pudo procesar el vídeo: ${s.status || s.status_code}`);
    }
  }
  throw new Error('Tiempo de procesado agotado; se reintentará manualmente');
}

async function llamar(url, body) {
  const r = await fetch(url, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

async function firmar(secreto, texto) {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function notificar(env, titulo, mensaje) {
  if (!env.NTFY_TOPIC) return;
  await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
    method: 'POST', headers: { Title: titulo }, body: mensaje,
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
