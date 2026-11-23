# Aplica — Tu monteur IA (guía de Pape San aplicada a Sherine)

Tú grabas, dejas los rushes en una carpeta y te vas. Tu agente (Claude Code) monta el vídeo en
**Edits Desktop** con TU estilo, lo exporta, lo apunta en tu Google Sheet y te manda
« Montage prêt » al móvil. Tú miras, corriges si hace falta y publicas.

```
DEPÓSITO ──▶ DETECCIÓN ──▶ MONTAJE ──▶ SEGUIMIENTO ──▶ NOTIF
móvil →       cada hora     Edits +      Google Sheet    ntfy en
Drive/Rush    (launchd)     CLAUDE.md                    tu móvil
```

## Qué hay en este repo

| Archivo | Para qué (capítulo de la guía) |
|---|---|
| `CLAUDE.md` | **Ficha de montaje** (cap. 06): tu receta, sacada de tus datos reales de Metricool, + reglas de seguridad (cap. 10). Claude Code la lee sola. |
| `scripts/vigilar-rushes.sh` | El circuito de rushes (cap. 07): detecta vídeos nuevos, lanza el montaje, anota en la Sheet, te notifica. |
| `scripts/com.sherine.monteur.plist` | La tarea programada del Mac: lanza el script cada hora. |
| `scripts/google-sheet.gs` | El seguimiento en Google Sheets, gratis (cap. 07). |
| `config.example.env` | Plantilla de configuración (rutas, ntfy, Sheet). |
| `cloudflare-worker/` | Publicación automática gratis con la API de Meta (cap. 09). **Opcional.** |
| `docs/publicar-con-api-meta.md` | Los 10 pasos de Meta resumidos (cap. 09). **Opcional.** |

---

## Lo que ya está hecho ✅

- **Tu ficha de montaje**, rellenada con el análisis de tus reels de Instagram y TikTok (mayo–nov 2026).
  Hallazgo principal: tus vídeos de **opinión a cámara** retienen al 60–75 % en los 3 primeros
  segundos; tus **BERRYVLOG** pierden al 52–72 % ahí mismo. La ficha obliga a arrancar los vlogs
  por el momento más fuerte.
- 4 recetas según la carpeta: `opinion/`, `vlog/`, `colab/`, `youtube/`.
- Reglas de seguridad: nada se publica ni se borra sin tu OK, los tokens nunca se muestran,
  nada generado por IA, y nunca se añade música.
- Todos los scripts del circuito y de la publicación.

## Lo que tienes que hacer tú en tu Mac (una tarde) 🔧

Estos pasos solo se pueden hacer desde tu Mac y tus cuentas, no desde aquí.

### Paso 1 — Edits Desktop (cap. 05)
1. Instala **Edits para Mac** (gratis) y conéctate con tu Instagram. Hace falta Mac con chip Apple (M1 o más reciente).
2. Ajustes → **Automatización** → « Activar el servidor de automatización ».
3. En « Conectar un cliente IA » → **Copiar** al lado de **Claude Code** → pégalo en el Terminal.
   Ese comando contiene tu token: no lo enseñes nunca. Si se filtra → « Regenerar ».
4. Comprueba en el Terminal: `claude mcp list` → debe aparecer el servidor de Edits.
   Si tiene otro nombre que `edits`, cambia `mcp__edits` en `scripts/vigilar-rushes.sh` por `mcp__<nombre>`.

### Paso 2 — Bajar este repo y configurarlo
```bash
cd ~ && git clone https://github.com/sherineberryfroff-collab/Aplica.git && cd Aplica
cp config.example.env config.env && chmod 600 config.env
open -e config.env      # rellena las rutas, el tema ntfy y la URL de la Sheet
mkdir -p logs
```

### Paso 3 — Carpetas en Google Drive (cap. 07)
1. Instala **Google Drive para ordenador** en el Mac.
2. En Drive crea `Rush/` con las subcarpetas `opinion`, `vlog`, `colab`, `youtube`, y una carpeta `Export/`.
3. Pon en `config.env` las rutas reales (en el Finder, botón derecho sobre la carpeta → mantén ⌥ → « Copiar como ruta »).

### Paso 4 — La tarea programada
```bash
sed -i '' "s#RUTA_DEL_REPO#$HOME/Aplica#g" scripts/com.sherine.monteur.plist
cp scripts/com.sherine.monteur.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.sherine.monteur.plist
```
Para pararla: `launchctl unload ~/Library/LaunchAgents/com.sherine.monteur.plist`.
El Mac tiene que estar encendido y con la sesión abierta (el script abre Edits solo).

### Paso 5 — Notificaciones y Sheet
- Instala la app **ntfy** en el móvil y suscríbete al tema que pusiste en `NTFY_TOPIC`.
- Crea la Sheet y el Apps Script siguiendo las instrucciones de `scripts/google-sheet.gs`.

### Paso 6 — Primera prueba
Deja un rush corto en `Rush/opinion/` desde el móvil y lánzalo a mano sin esperar la hora:
```bash
bash scripts/vigilar-rushes.sh && tail -50 logs/montajes.log
```

### Paso 7 — Entrenar a tu monteur (cap. 06, el más importante)
- Cada vez que corrijas un montaje, abre Claude Code en esta carpeta y dile:
  *« Ajoute à ta fiche : … »* (o en español). Lo apuntará en la sección 8 de `CLAUDE.md`.
- Rellena con él la sección 7 « Lo que Sherine detesta ».
- **No lo juzgues por su primer vídeo, júzgalo por el vigésimo.**

---

## Publicar (cap. 08)

**Mi recomendación: empieza por Metricool.** Ya lo tienes conectado (Instagram, TikTok, YouTube)
y es exactamente la « Partie 1 » de la guía: la opción más simple y segura para tu cuenta.
Desde Claude puedo programarte los posts en Metricool cuando tú me des el OK, en tus mejores horas.

La **API de Meta + Cloudflare** (`cloudflare-worker/` y `docs/publicar-con-api-meta.md`) es gratis
pero más técnica y solo publica en Instagram. Úsala solo si quieres ahorrarte la suscripción.
Aunque esté todo automatizado: **revisa cada vídeo antes de que salga.**

## Seguridad (cap. 10)
- `config.env`, `secretos/`, `.dev.vars` y cualquier `*.token` están en `.gitignore`: nunca se suben.
- Un token = una contraseña. Nunca en una captura, nunca en la nube, nunca pegado en una conversación (tampoco conmigo).
- Si un token se filtra: regenéralo enseguida en Edits o en tu portafolio business.
