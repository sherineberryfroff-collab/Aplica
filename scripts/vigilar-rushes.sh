#!/bin/bash
# =============================================================================
#  Circuito de rushes (capítulo 07): DEPÓSITO → DETECCIÓN → MONTAJE → SEGUIMIENTO → NOTIF
#  Lo lanza launchd cada hora (scripts/com.sherine.monteur.plist).
#  Compatible con el bash 3.2 de macOS.
# =============================================================================
set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_DIR/config.env"
LOG_DIR="$REPO_DIR/logs"
HECHOS="$LOG_DIR/rushes-procesados.txt"
LOCK="$LOG_DIR/.montaje.lock"

mkdir -p "$LOG_DIR"
touch "$HECHOS"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_DIR/vigilar.log"; }

if [ ! -f "$CONFIG" ]; then log "Falta config.env"; exit 1; fi
# shellcheck disable=SC1090
source "$CONFIG"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Un solo montaje a la vez
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  log "Ya hay un montaje en curso, salgo."; exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

notificar() { # $1 título, $2 mensaje
  [ -n "${NTFY_TOPIC:-}" ] || return 0
  curl -s -H "Title: $1" -d "$2" "https://ntfy.sh/$NTFY_TOPIC" > /dev/null
}

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }

anotar_sheet() { # titulo cuenta duracion archivo
  [ -n "${SHEET_WEBHOOK_URL:-}" ] || return 0
  curl -s -L -X POST "$SHEET_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$(json_escape "${SHEET_KEY:-}")\",\"titulo\":\"$(json_escape "$1")\",\"cuenta\":\"$(json_escape "$2")\",\"duracion\":\"$(json_escape "$3")\",\"archivo\":\"$(json_escape "$4")\",\"estado\":\"listo, no publicado\"}" \
    > /dev/null
}

# Abrir Edits si no está abierto (tiene que estar corriendo para el MCP)
if ! pgrep -xq "Edits"; then
  open -a "Edits" 2>/dev/null && sleep 20
fi

mkdir -p "$EXPORT_DIR"

find "$RUSH_DIR" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) \
     -mmin +"${MIN_EDAD_MIN:-3}" -not -path '*/_*' 2>/dev/null | sort |
while IFS= read -r RUSH; do
  grep -Fxq "$RUSH" "$HECHOS" && continue

  CARPETA="$(basename "$(dirname "$RUSH")")"
  [ "$(dirname "$RUSH")" = "$RUSH_DIR" ] && CARPETA="(sin carpeta)"
  log "Nuevo rush: $RUSH (receta según carpeta: $CARPETA)"

  PROMPT="Nuevo rush para montar: \"$RUSH\" (carpeta: $CARPETA).
Relee CLAUDE.md (tu ficha de montaje) y aplica la receta que corresponde a esa carpeta.
Monta el vídeo en Edits Desktop con el MCP de Edits y exporta el resultado en \"$EXPORT_DIR\".
NO publiques nada, NO borres nada. Termina con la línea RESULTADO|... tal como indica la ficha."

  SALIDA="$(cd "$REPO_DIR" && claude -p "$PROMPT" \
            --allowedTools "mcp__edits" "Read" "Glob" "Grep" \
            < /dev/null 2>>"$LOG_DIR/vigilar.log")"
  printf '%s\n\n' "----- $(date) $RUSH -----" "$SALIDA" >> "$LOG_DIR/montajes.log"

  LINEA="$(printf '%s\n' "$SALIDA" | grep '^RESULTADO|' | tail -1)"
  if [ -z "$LINEA" ]; then
    log "Montaje sin RESULTADO para $RUSH"
    notificar "⚠️ Montaje con problema" "$(basename "$RUSH"): revisa logs/montajes.log"
    continue   # no se marca como hecho: se reintenta en la próxima pasada
  fi

  TITULO="$(echo "$LINEA" | cut -d'|' -f2)"
  CUENTA="$(echo "$LINEA" | cut -d'|' -f3)"
  DURACION="$(echo "$LINEA" | cut -d'|' -f4)"
  ARCHIVO="$(echo "$LINEA" | cut -d'|' -f5-)"

  echo "$RUSH" >> "$HECHOS"
  anotar_sheet "$TITULO" "$CUENTA" "$DURACION" "$ARCHIVO"
  notificar "🎬 Montage prêt" "$TITULO ($DURACION s) — $CUENTA"
  log "OK: $TITULO -> $ARCHIVO"
done
