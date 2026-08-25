#!/usr/bin/env bash
# Diagnóstico del connector MCP. No imprime el token ni ninguna otra env var:
# sólo si están, y qué contesta el endpoint en vivo.
set -uo pipefail

APP_ID="fuL6CygmylbkVobI4KpPQ"
BASE="https://appgym.mrhapps.mx/api/mcp"
: "${DOKPLOY_URL:?falta DOKPLOY_URL}"
: "${DOKPLOY_TOKEN:?falta DOKPLOY_TOKEN}"

ENV_ACTUAL=$(curl -sf "$DOKPLOY_URL/api/application.one?applicationId=$APP_ID" \
  -H "x-api-key: $DOKPLOY_TOKEN" | jq -r '.env // ""')

if ! printf '%s' "$ENV_ACTUAL" | grep -q '^MCP_TOKEN='; then
  echo "✗ MCP_TOKEN NO está en las env vars de Dokploy."
  echo "  Corre: bash scripts/setup-mcp-token.sh"
  exit 1
fi

TOKEN=$(printf '%s' "$ENV_ACTUAL" | grep '^MCP_TOKEN=' | head -1 | cut -d= -f2- | tr -d '[:space:]')
echo "✓ MCP_TOKEN está guardado en Dokploy (${#TOKEN} caracteres)"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/$TOKEN" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')

if [ "$CODE" = "200" ]; then
  N=$(curl -s -X POST "$BASE/$TOKEN" -H 'content-type: application/json' \
        -H 'accept: application/json, text/event-stream' \
        -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
      | sed -n 's/^data: //p' | jq -r '.result.tools | length')
  echo "✓ El endpoint responde 200 y expone $N herramientas."
  echo
  echo "Pega EXACTAMENTE esta URL en el connector (sin espacios ni salto de línea):"
  echo
  echo "$BASE/$TOKEN"
elif [ "$CODE" = "404" ]; then
  echo "✗ El endpoint da 404 con el token que está guardado en Dokploy."
  echo "  Significa que el contenedor todavía corre SIN esa variable: el redeploy"
  echo "  no ha terminado o no se disparó. Espera 1-3 min y vuelve a correr esto,"
  echo "  o dispara un deploy manual."
else
  echo "✗ El endpoint contestó $CODE (esperaba 200)."
fi
