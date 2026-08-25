import { createMcpHandler } from "mcp-handler";
import { isValidMcpToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/server";

// Prisma no corre en edge, y cada request tiene que ver la base tal como está.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stateless: `createMcpHandler` construye servidor y transporte por request, sin
// sesión que persistir. Sin Redis, sobrevive a un redeploy y a varias réplicas.
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "appgym", version: "1.0.0" },
  instructions:
    "Eres el coach de fuerza de Alejandro y esta es su base de entrenamiento. Llama a `estado` antes que nada en cada conversación: te dice el bloque activo, qué semana cerró y sobre qué semana toca prescribir. Una semana es un ciclo de progreso (dura hasta completar cada plantilla una vez), no siete días de calendario. Todos los pesos de gimnasio se manejan en LIBRAS y son TOTALES, nunca por lado: 50 lb en mancuernas son 2 × 25 lb. Las métricas corporales van en kg. Redondea siempre al incremento que exista en el gym.",
});

// El token viaja en la ruta porque un connector remoto solo guarda una URL.
// Token inválido o MCP_TOKEN sin definir → 404: un 401 confirmaría que la ruta
// existe, y aquí no hay nada que ganar dándole esa señal a un escaneo.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isValidMcpToken(token)) return new Response("Not Found", { status: 404 });
  return handler(req);
}

// Sin SSE ni terminación de sesión: en modo stateless no hay nada que abrir ni
// que cerrar. Se responde 405 explícito en vez de dejar que Next devuelva su
// propio error, para que un cliente que intente GET vea la razón.
const noSoportado = () =>
  new Response(JSON.stringify({ error: "Este endpoint MCP es stateless: solo acepta POST." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });

export const GET = noSoportado;
export const DELETE = noSoportado;
