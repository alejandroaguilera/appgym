// Client-side shapes mirroring the Prisma models that live in IndexedDB.
// Dates are stored as native Date objects (IndexedDB structured-clone supports them);
// they're serialized to ISO strings only when sent over the wire in lib/sync.

export type EstadoSessionLog = "EN_PROGRESO" | "COMPLETADA" | "ABANDONADA";
export type TipoSet = "TRABAJO" | "CALENTAMIENTO" | "DROPSET" | "FALLO";

export interface SessionLogRecord {
  id: string; // client UUID v4
  atletaId: string;
  scheduledSessionId: string | null;
  sessionTemplateId: string | null;
  iniciadaEn: Date;
  finalizadaEn: Date | null;
  estado: EstadoSessionLog;
  duracionActivaSeg: number | null;
  energia1a5: number | null;
  suenoHorasPrevias: number | null;
  pesoCorporalKg: number | null;
  notas: string | null;
}

export interface SetLogRecord {
  id: string; // client UUID v4
  sessionLogId: string;
  exerciseId: string;
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  rir: number | null;
  tipo: TipoSet;
  completadaEn: Date;
  descansoRealSeg: number | null;
  notas: string | null;
  molestiaFlag: boolean;
  molestiaZona: string | null;
  molestiaNivel1a10: number | null;
  version: number;
  deleted?: boolean; // tombstone for local undo-after-sync
}

export interface PauseRecord {
  seq?: number; // autoIncrement
  sessionLogId: string;
  pausedAt: number; // epoch ms
  resumedAt: number | null;
}

export type RestTimerStatus = "running" | "paused" | "dismissed";

export interface RestTimerRecord {
  sessionLogId: string; // keyPath — one active rest timer per session
  exerciseId: string;
  templateExerciseId: string | null;
  startedAt: number; // epoch ms, absolute
  durationSec: number;
  status: RestTimerStatus;
}

export interface ExerciseContext {
  templateExerciseId: string | null; // null when added ad-hoc mid-session
  exerciseId: string;
  nombre: string;
  notas: string | null;
  seriesObjetivo: number;
  repsMin: number;
  repsMax: number | null;
  unidadReps: "REPS" | "SEGUNDOS";
  rirObjetivo: number | null;
  descansoSeg: number;
  incrementoMinimoKg: number;
  condicion: string | null;
  esOpcional: boolean;
  objetivoHoy: { pesoSugerido: number | null; repsSugeridas: number | null; texto: string };
  desempenoAnterior: { pesoKg: number; reps: number; rir: number | null }[];
}

export interface SessionContextRecord {
  sessionLogId: string; // keyPath
  sessionTemplateId: string | null;
  nombreSesion: string;
  numeroSemana: number | null;
  exercises: ExerciseContext[];
}

export type OutboxMethod = "PUT" | "DELETE" | "POST";

export interface OutboxRecord {
  seq?: number; // autoIncrement, defines drain order
  eventId: string; // uuid, idempotency key echoed to the server
  method: OutboxMethod;
  url: string;
  body: unknown;
  timestampCliente: number; // epoch ms
  intentos: number;
  nextAttemptAt: number; // epoch ms
  permanentError: string | null;
}
