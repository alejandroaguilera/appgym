// Formato de intercambio del plan de entrenamiento y utilidades compartidas
// entre `plan-export.ts` y `plan-import.ts`.
//
// Los scripts hablan con la app por HTTP, no con Prisma: el Postgres de
// Dokploy sólo es alcanzable desde dentro de la red del swarm, mientras que
// `/api/blocks` y `/api/exercises` no piden auth (la app es de un solo atleta
// y `getAthleteId` resuelve al único usuario). Eso además hace que el script
// corra igual contra producción o contra un `next dev` local cambiando
// APPGYM_URL.

export const BASE_URL = (process.env.APPGYM_URL ?? "https://appgym.mrhapps.mx").replace(/\/$/, "");

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}\n${texto.slice(0, 800)}`);
  }
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

// ── Forma del archivo ────────────────────────────────────────────────────

// Las claves con prefijo `_` son anotaciones para quien edita el archivo por
// fuera; el importador las quita antes de validar contra `blockSchema`. La
// única que lee es `_ejercicio` (para resolver el ejercicio cuando no viene
// `exerciseId`) y `_nuevo` (para dar de alta uno que no existe).
export interface PlanExercise {
  _ejercicio: string;
  _nuevo?: {
    grupoMuscularPrimario: string;
    patronMovimiento: string;
    equipo: string;
    alias?: string[];
    unilateral?: boolean;
    incrementoMinimoKg?: number;
  };
  exerciseId?: string;
  orden: number;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  unidadReps: "REPS" | "SEGUNDOS";
  rirObjetivo: number | null;
  descansoSeg: number;
  notas: string | null;
  agrupacion: string | null;
  esOpcional: boolean;
  condicion: string | null;
}

export interface PlanSession {
  clave: string;
  nombre: string;
  orden: number;
  notas: string | null;
  duracionEstimadaMin: number | null;
  templateExercises: PlanExercise[];
}

export interface PlanOverride {
  numeroSemana: number;
  deltaSeries: number;
  rirObjetivo: number | null;
  nota: string | null;
}

export interface PlanFile {
  _instrucciones?: string[];
  _blockId?: string;
  _exportadoEn?: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "BORRADOR" | "ACTIVO" | "COMPLETADO" | "ARCHIVADO";
  notas: string | null;
  weekOverrides: PlanOverride[];
  sessionTemplates: PlanSession[];
  _catalogo?: CatalogoEntry[];
}

export interface CatalogoEntry {
  id: string;
  nombre: string;
  alias: string[];
  grupoMuscularPrimario: string;
  patronMovimiento: string;
  equipo: string;
}

// ── Tipos de la API ──────────────────────────────────────────────────────

export interface ApiExercise extends CatalogoEntry {
  gruposSecundarios: string[];
  unilateral: boolean;
  incrementoMinimoKg: number;
}

export interface ApiBlock {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: PlanFile["estado"];
  notas: string | null;
  weekOverrides: (PlanOverride & { id: string })[];
  sessionTemplates: {
    id: string;
    clave: string;
    nombre: string;
    orden: number;
    notas: string | null;
    duracionEstimadaMin: number | null;
    templateExercises: (Omit<PlanExercise, "_ejercicio"> & { exercise: ApiExercise })[];
  }[];
}

// ── Conversión API → archivo ─────────────────────────────────────────────

const dia = (iso: string) => iso.slice(0, 10);

// Usada por el exportador para escribir el archivo y por el importador para
// traer el estado actual a la misma forma antes de diffear. Que sea la misma
// función es lo que hace que exportar e importar sin editar dé diff vacío.
export function bloqueAPlan(block: ApiBlock): PlanFile {
  return {
    nombre: block.nombre,
    fechaInicio: dia(block.fechaInicio),
    fechaFin: dia(block.fechaFin),
    estado: block.estado,
    notas: block.notas ?? null,
    weekOverrides: [...block.weekOverrides]
      .sort((a, b) => a.numeroSemana - b.numeroSemana)
      .map((o) => ({
        numeroSemana: o.numeroSemana,
        deltaSeries: o.deltaSeries,
        rirObjetivo: o.rirObjetivo,
        nota: o.nota ?? null,
      })),
    sessionTemplates: [...block.sessionTemplates]
      .sort((a, b) => a.orden - b.orden)
      .map((st) => ({
        clave: st.clave,
        nombre: st.nombre,
        orden: st.orden,
        notas: st.notas ?? null,
        duracionEstimadaMin: st.duracionEstimadaMin ?? null,
        templateExercises: [...st.templateExercises]
          .sort((a, b) => a.orden - b.orden)
          .map((te) => ({
            _ejercicio: te.exercise.nombre,
            exerciseId: te.exercise.id,
            orden: te.orden,
            seriesObjetivo: te.seriesObjetivo,
            repsMin: te.repsMin,
            repsMax: te.repsMax,
            unidadReps: te.unidadReps,
            rirObjetivo: te.rirObjetivo,
            descansoSeg: te.descansoSeg,
            notas: te.notas ?? null,
            agrupacion: te.agrupacion ?? null,
            esOpcional: te.esOpcional,
            condicion: te.condicion ?? null,
          })),
      })),
  };
}

// ── Utilidades ───────────────────────────────────────────────────────────

// Sin acentos, sin mayúsculas, sin espacios de más: "Rotación Externa con
// Banda" y "rotacion externa con banda" tienen que resolver al mismo
// ejercicio, porque quien edita el archivo por fuera no va a copiar el
// nombre carácter por carácter.
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function repsTexto(e: Pick<PlanExercise, "repsMin" | "repsMax" | "unidadReps">): string {
  const rango = e.repsMax != null && e.repsMax !== e.repsMin ? `${e.repsMin}-${e.repsMax}` : `${e.repsMin}`;
  return e.unidadReps === "SEGUNDOS" ? `${rango} s` : rango;
}

export async function getBloqueActivo(): Promise<string> {
  const { blocks } = await api<{ blocks: { id: string; nombre: string; estado: string }[] }>("/api/blocks");
  const activo = blocks.find((b) => b.estado === "ACTIVO");
  if (!activo) {
    throw new Error("No hay ningún bloque ACTIVO. Pasa --block <id> explícitamente.");
  }
  return activo.id;
}
