# Publicar gratis con la API de Meta (cap. 09) — OPCIONAL

> ⚠️ Si empiezas, usa Metricool (ya lo tienes). Esto es para cuando quieras ahorrar la suscripción.
> Úsalo con moderación: demasiadas acciones automáticas (p. ej. 10 vídeos al día y borrarlos)
> pueden hacer que Meta restrinja tu cuenta y hasta tu cuenta publicitaria.

## Antes de empezar
Tu Instagram debe ser **profesional** (creador) y estar **vinculado a tu Página de Facebook**.
Instagram → Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional.

## Conectar Instagram y Facebook a una app de Meta

| # | Dónde | Qué hacer |
|---|---|---|
| 1 | business.facebook.com → Configuración → Cuentas → **Páginas** | « + Añadir » y elige tu Página (si no tienes portafolio business, Meta te crea uno gratis). |
| 2 | Configuración → Cuentas → **Perfiles de Instagram** | « + Añadir » y conéctate con tu Instagram. |
| 3 | developers.facebook.com → Mis apps | « Crear una app ». |
| 4 | | Nombre (solo lo ves tú) + email de contacto → Siguiente. |
| 5 | Casos de uso → filtro **Gestión del contenido** | Marca « Gestionar mensajes y contenido en Instagram » → Siguiente. |
| 6 | | Elige tu portafolio business → Siguiente → salta « Requisitos » y « Resumen » → **Crear app**. |
| 7 | Tu app → Casos de uso → **Personalizar** (línea Instagram) → Permisos y funciones | « + Añadir »: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management` (+ `pages_manage_posts` si quieres publicar en tu Página). Estado: « Listo para la prueba ». |
| 8 | business.facebook.com → Configuración → **Usuarios del sistema** | « + Añadir », rol **Admin**. « Asignar activos » → control total de tu app, tu Página y tu Instagram. |
| 9 | Usuario del sistema → **Generar nuevo token** | Elige tu app · Caducidad **« Nunca »** · marca los permisos del paso 7 · Generar. **Cópialo enseguida** (solo se muestra una vez) y guárdalo en `secretos/meta.token` en tu Mac (`chmod 600`). |
| 10 | Prueba | Pide a Claude que encuentre el ID de tu Instagram vía tu Página y publique un vídeo de prueba (con tu OK). |

La app puede quedarse en **modo desarrollo** mientras solo publiques en TUS cuentas.

### Cómo publica la API un Reel
1. Crear un « contenedor » (vídeo + caption) → 2. Esperar a que Instagram procese el vídeo → 3. Publicar.
La API también sabe publicar en **trial reel** (`"trial": true` en la cola).

## Publicar solo con Cloudflare (Mac apagado)

```bash
cd cloudflare-worker
npm install -g wrangler        # o: npx wrangler ...
wrangler login                 # 1. cuenta Cloudflare gratis
wrangler r2 bucket create sherine-reels          # 2. bucket R2
wrangler secret put META_TOKEN                   # 6. secretos (pega el valor cuando lo pida)
wrangler secret put IG_USER_ID
wrangler secret put LINK_SECRET                  # cualquier cadena larga aleatoria
wrangler secret put NTFY_TOPIC
wrangler deploy                                  # 3-4. Worker + cron cada 5 min
```
Después del primer deploy, copia la URL `*.workers.dev` en `PUBLIC_URL` de `wrangler.toml` y vuelve a hacer `wrangler deploy`.

**Programar un post:**
```bash
wrangler r2 object put sherine-reels/videos/2026-11-24_opinion_createurs-nuls.mp4 --file ../Export/2026-11-24_opinion_createurs-nuls.mp4 --remote
# edita cola.json (ver cola.ejemplo.json), pon "aprobado": true SOLO tras revisar el vídeo
wrangler r2 object put sherine-reels/cola.json --file cola.json --remote
```
5. A la hora prevista el Worker crea un enlace temporal (1 h) al vídeo, se lo pasa a Instagram,
espera el procesado, publica, borra el vídeo de R2 y te avisa por ntfy. Publica **un post por pasada**, por prudencia.

Coste: gratis a pequeño volumen (10 GB de R2 incluidos, luego 0,015 $/GB/mes).
