import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getAthleteId } from "@/lib/athlete";
import { estado } from "@/lib/mcp/tools/estado";
import { historial } from "@/lib/mcp/tools/historial";
import { catalogoEjercicios } from "@/lib/mcp/tools/catalogo";
import { ajustarSemana, ErrorAccionable } from "@/lib/mcp/tools/ajustar-semana";
import { crearBloque } from "@/lib/mcp/tools/crear-bloque";

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

// Peso en LIBRAS y TOTAL (las dos mancuernas sumadas, o el valor de la placa),
// nunca por lado. Se redondea al incremento real del equipo al guardarlo.
const pesoLb = z
  .number()
  .positive()
  .describe(
    "Peso objetivo en LIBRAS y TOTAL: en mancuernas es la suma de las dos (50 = 2 × 25 lb), en poleas y máquinas el valor de la placa. Nunca por lado. Se redondea al incremento mínimo del equipo. Omítelo para que la app calcule la carga por doble progresión."
  );

const ejercicioPrescrito = z.object({
  ejercicio_id: z.string().describe("Id real del catálogo. Resuélvelo con catalogo_ejercicios; un nombre no sirve."),
  orden: z.number().int().min(1).describe("Posición del ejercicio dentro de la sesión."),
  series: z.number().int().min(1),
  reps_min: z.number().int().min(1),
  reps_max: z.number().int().min(1).nullable().optional(),
  rir_objetivo: z.number().int().min(0).max(4).nullable().optional(),
  descanso_seg: z.number().int().min(0).nullable().optional(),
});

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

  server.registerTool(
    "ajustar_semana",
    {
      title: "Prescribir la semana que sigue",
      description:
        "Escribe la prescripción de una semana del bloque activo: carga, series, reps, RIR y qué ejercicios entran o salen. Es la herramienta que usas cada semana después de revisar el progreso.\n\nLas sesiones que incluyas quedan definidas por completo para esa semana: la lista de ejercicios que mandes REEMPLAZA la de la plantilla, y la nota de cada ejercicio reemplaza la anterior (nunca se acumulan). Las sesiones que no menciones se quedan con el plan base del bloque.\n\nUn peso prescrito sustituye el cálculo automático de la app para esa semana; si lo omites, la app sigue calculando por doble progresión. Pesos en LIBRAS y TOTALES.\n\nSolo acepta semanas sobre las que todavía no se ha entrenado. Llamarla dos veces sobre la misma semana deja un solo ajuste.",
      inputSchema: z.object({
        numero_semana: z
          .number()
          .int()
          .min(1)
          .describe("Número de semana dentro del bloque activo, tal como lo devuelve `estado` en semana_a_prescribir.numero."),
        sesiones: z
          .array(
            z.object({
              letra: z.string().min(1).max(1).describe("Letra de la sesión en el bloque (A, B, C…)."),
              ejercicios: z.array(ejercicioPrescrito.extend({
                peso_objetivo_lb: pesoLb.nullable().optional(),
                nota: z
                  .string()
                  .nullable()
                  .optional()
                  .describe("Nota para ESTA semana. Reemplaza la anterior por completo — no escribas una nota que hable de otra semana."),
              })),
            })
          )
          .min(1),
        nota_semana: z
          .string()
          .nullable()
          .optional()
          .describe("Foco general de la semana. Se muestra en la pantalla de Hoy."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        return json(await ajustarSemana(await getAthleteId(), args));
      } catch (e) {
        if (e instanceof ErrorAccionable) return problema(e.message);
        throw e;
      }
    }
  );

  server.registerTool(
    "crear_bloque",
    {
      title: "Crear un bloque de entrenamiento",
      description:
        "Abre un ciclo nuevo: define qué sesiones lo componen y con qué ejercicios. Es la operación ocasional — la decisión de cuándo cerrar un bloque y arrancar el siguiente es tuya, a partir del progreso, no de un calendario fijo.\n\nActivar un bloque deja el anterior en COMPLETADO. Aquí se define la estructura, no las cargas: prescribe las cargas después con ajustar_semana.\n\nUn bloque sobre el que ya se entrenó no puede reescribirse.",
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe("Solo para corregir un bloque recién creado sobre el que aún no se entrena. Omítelo para crear uno nuevo."),
        nombre: z.string().min(1),
        fecha_inicio: z.string().regex(DIA, "Usa el formato YYYY-MM-DD"),
        fecha_fin: z.string().regex(DIA, "Usa el formato YYYY-MM-DD"),
        notas: z.string().nullable().optional(),
        activar: z
          .boolean()
          .optional()
          .describe("Por defecto true: lo deja ACTIVO y pasa el bloque anterior a COMPLETADO. Con false queda en BORRADOR."),
        sesiones: z
          .array(
            z.object({
              letra: z.string().min(1).max(1).describe("Un solo carácter: A, B, C…"),
              nombre: z.string().min(1).describe('Nombre visible de la sesión, ej. "Upper A".'),
              orden: z.number().int().min(1).optional(),
              notas: z.string().nullable().optional(),
              ejercicios: z.array(ejercicioPrescrito.extend({
                nota: z.string().nullable().optional(),
              })).min(1),
            })
          )
          .min(1),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        return json(await crearBloque(await getAthleteId(), args));
      } catch (e) {
        if (e instanceof ErrorAccionable) return problema(e.message);
        throw e;
      }
    }
  );
}
