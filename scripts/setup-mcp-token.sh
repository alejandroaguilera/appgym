#!/usr/bin/env bash
# Genera MCP_TOKEN y lo AGREGA a las env vars de appgym en Dokploy.
#
# saveEnvironment reemplaza el bloque completo, así que hay que leer lo que ya
# está y volver a mandarlo con la línea nueva al final. Nada del contenido se
# imprime: lo único que sale a pantalla es la URL del connector.
set -euo pipefail

# DOKPLOY_URL y DOKPLOY_TOKEN viven en ~/.bashrc, que un shell NO interactivo
# (como el que abre `! comando`) no carga. Sin esto el script moría en la
# primera línea sin decir por qué.
if [ -z "${DOKPLOY_URL:-}" ] || [ -z "${DOKPLOY_TOKEN:-}" ]; then
  # shellcheck disable=SC1090
  [ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" 2>/dev/null || true
fi

APP_ID="fuL6CygmylbkVobI4KpPQ"
: "${DOKPLOY_URL:?falta DOKPLOY_URL}"
: "${DOKPLOY_TOKEN:?falta DOKPLOY_TOKEN}"

APP=$(curl -sf "$DOKPLOY_URL/api/application.one?applicationId=$APP_ID" -H "x-api-key: $DOKPLOY_TOKEN")
ENV_ACTUAL=$(printf '%s' "$APP" | jq -r '.env // ""')
if [ -z "$ENV_ACTUAL" ]; then echo "ABORTO: no pude leer el env actual; no piso nada." >&2; exit 1; fi

if printf '%s' "$ENV_ACTUAL" | grep -q '^MCP_TOKEN='; then
  echo "Ya existe un MCP_TOKEN. Tu URL de connector:"
  echo "https://appgym.mrhapps.mx/api/mcp/$(printf '%s' "$ENV_ACTUAL" | grep '^MCP_TOKEN=' | cut -d= -f2-)"
  exit 0
fi

TOKEN=$(openssl rand -hex 32)
NUEVO=$(printf '%s\nMCP_TOKEN=%s' "$ENV_ACTUAL" "$TOKEN")

# saveEnvironment reemplaza el bloque completo y además exige buildArgs,
# buildSecrets y createEnvFile — omitirlos devuelve un 400 de validación. Se
# reenvían tal como están para no alterarlos.
printf '%s' "$APP" | jq --arg id "$APP_ID" --arg env "$NUEVO" \
  '{applicationId:$id, env:$env, buildArgs:.buildArgs, buildSecrets:.buildSecrets, createEnvFile:.createEnvFile}' \
  | curl -sf -X POST "$DOKPLOY_URL/api/application.saveEnvironment" \
      -H "x-api-key: $DOKPLOY_TOKEN" -H "Content-Type: application/json" --data @- > /dev/null

curl -sf -X POST "$DOKPLOY_URL/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"applicationId\": \"$APP_ID\"}" > /dev/null

echo "MCP_TOKEN agregado y redeploy disparado. Espera 1-3 min y registra esta URL"
echo "en Claude → Settings → Connectors → Add custom connector:"
echo
echo "https://appgym.mrhapps.mx/api/mcp/$TOKEN"
