import { timingSafeEqual } from "node:crypto";

// El token viaja en el segmento de ruta (SPEC §4): un connector remoto de
// Claude solo guarda una URL, no headers. Comparación en tiempo constante para
// que la latencia de la respuesta no filtre cuántos caracteres coinciden.
//
// Sin MCP_TOKEN definido el servidor no existe — 404, no 401 y jamás abierto.
// Un 401 confirmaría que la ruta está ahí; el 404 no distingue "token malo" de
// "esta app no tiene MCP", que es justo lo que queremos frente a un escaneo.
export function isValidMcpToken(candidate: string | undefined): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length === 0) return false;
  if (!candidate || candidate.length === 0) return false;

  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual revienta si difieren en longitud, así que la longitud sí
  // se compara antes (y sí se filtra). Es información de bajo valor frente a
  // un token de 64 hex y no hay forma de evitarlo sin hashear ambos lados.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
