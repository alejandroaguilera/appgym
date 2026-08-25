import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getAthleteId } from "@/lib/athlete";
import { estado } from "@/lib/mcp/tools/estado";
import { historial } from "@/lib/mcp/tools/historial";
import { catalogoEjercicios } from "@/lib/mcp/tools/catalogo";

// Las herramientas devuelven objetos; el protocolo espera contenido. Un solo
// bloque de texto con el JSON indentado es lo que mejor leen los clientes hoy
// (structuredContent aún no lo consumen todos por igual).
function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// Un error de herramienta tiene que ser accionable, no un stack trace
// (SPEC §5.6): el coach debe poder corregir sin ver el código.
function problema(mensaje: string) {
  return { content: [{ type: "text" as const, text: mensaje }], isError: true };
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export function registerTools(server: McpServer): void {
  server.registerTool(
    "estado",
    {
      title: "Estado actual del entrenamiento",
      description:
        "Orientación completa en una llamada: bloque activo, semana en curso, semana que cerró, la semana que toca prescribir, última sesión, adherencia, peso corporal y PRs recientes. Llámala SIEMPRE al inicio de la conversación antes de cualquier otra cosa. Una 'semana' es un ciclo de progreso identificado por numero_semana dentro del bloque, no una semana de calendario. Los pesos de gimnasio salen en libras (totales, nunca por lado); las métricas corporales en kg.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(await estado(await getAthleteId()))
  );

  server.registerTool(
    "historial",
    {
      title: "Historial crudo de un rango",
      description:
        "Todo lo ocurrido entre dos fechas, en crudo y en una sola respuesta: los bloques con su prescripción (plantillas, series, reps, RIR), las sesiones con todas sus series (peso, reps, RIR, molestias), los PRs, las métricas corporales y los ajustes semanales aplicados. Úsala para comparar lo prescrito contra lo ejecutado antes de decidir la progresión. Los cortes por semana, ejercicio o volumen los calculas tú. Filtra por fecha de inicio de sesión. Pesos de gimnasio en libras (totales), métricas corporales en kg.",
      inputSchema: z.object({
        desde: z.string().regex(DIA, "Usa el formato YYYY-MM-DD").describe("Primer día del rango, inclusive (YYYY-MM-DD)."),
        hasta: z.string().regex(DIA, "Usa el formato YYYY-MM-DD").describe("Último día del rango, inclusive (YYYY-MM-DD)."),
        incluir_series: z
          .boolean()
          .optional()
          .describe("Si es false, omite las series individuales y deja solo los totales por sesión. Por defecto true."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        return json(await historial(await getAthleteId(), args));
      } catch (e) {
        return problema(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.registerTool(
    "catalogo_ejercicios",
    {
      title: "Catálogo de ejercicios",
      description:
        "Los ejercicios disponibles con su id, nombre, alias, grupo muscular, patrón de movimiento, equipo e incremento mínimo de carga. Necesaria antes de escribir: las herramientas de prescripción exigen ids reales y nunca crean un ejercicio a partir de un nombre inventado.",
      inputSchema: z.object({
        busqueda: z
          .string()
          .optional()
          .describe("Filtro por nombre, alias o grupo muscular. Sin este parámetro devuelve el catálogo completo."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => json(await catalogoEjercicios(args))
  );
}
