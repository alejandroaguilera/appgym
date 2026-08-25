#!/usr/bin/env bash
# Genera MCP_TOKEN y lo AGREGA a las env vars de appgym en Dokploy.
#
# saveEnvironment reemplaza el bloque completo, así que hay que leer lo que ya
# está y volver a mandarlo con la línea nueva al final. Nada del contenido se
# imprime: lo único que sale a pantalla es la URL del connector.
set -euo pipefail

APP_ID="fuL6CygmylbkVobI4KpPQ"
: "${DOKPLOY_URL:?falta DOKPLOY_URL}"
: "${DOKPLOY_TOKEN:?falta DOKPLOY_TOKEN}"

ENV_ACTUAL=$(curl -sf "$DOKPLOY_URL/api/application.one?applicationId=$APP_ID" \
  -H "x-api-key: $DOKPLOY_TOKEN" | jq -r '.env // ""')

if printf '%s' "$ENV_ACTUAL" | grep -q '^MCP_TOKEN='; then
  echo "Ya existe un MCP_TOKEN. Tu URL de connector:"
  echo "https://appgym.mrhapps.mx/api/mcp/$(printf '%s' "$ENV_ACTUAL" | grep '^MCP_TOKEN=' | cut -d= -f2-)"
  exit 0
fi

TOKEN=$(openssl rand -hex 32)
NUEVO=$(printf '%s\nMCP_TOKEN=%s' "$ENV_ACTUAL" "$TOKEN")

jq -n --arg id "$APP_ID" --arg env "$NUEVO" '{applicationId:$id, env:$env}' \
  | curl -sf -X POST "$DOKPLOY_URL/api/application.saveEnvironment" \
      -H "x-api-key: $DOKPLOY_TOKEN" -H "Content-Type: application/json" --data @- > /dev/null

curl -sf -X POST "$DOKPLOY_URL/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"applicationId\": \"$APP_ID\"}" > /dev/null

echo "MCP_TOKEN agregado y redeploy disparado. Espera 1-3 min y registra esta URL"
echo "en Claude → Settings → Connectors → Add custom connector:"
echo
echo "https://appgym.mrhapps.mx/api/mcp/$TOKEN"
