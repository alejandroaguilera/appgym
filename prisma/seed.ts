import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Deterministic PRNG (mulberry32) so re-seeding produces the same
// synthetic BodyMetric data every time. ──────────────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ExerciseMeta {
  grupoMuscularPrimario: string;
  gruposSecundarios: string[];
  patronMovimiento:
    | "EMPUJE_HORIZONTAL"
    | "EMPUJE_VERTICAL"
    | "JALON_HORIZONTAL"
    | "JALON_VERTICAL"
    | "DOMINANTE_RODILLA"
    | "DOMINANTE_CADERA"
    | "AISLAMIENTO"
    | "CORE"
    | "CORRECTIVO";
  equipo: "BARRA" | "MANCUERNA" | "POLEA" | "MAQUINA" | "PESO_CORPORAL" | "BANDA";
  unilateral: boolean;
  incrementoMinimoKg: number;
  alias: string[];
}

// Inferred equipment/pattern metadata — §11 only specifies series/reps/RIR/
// descanso per exercise, not the catalog attributes, so these are
// reasonable defaults that affect display/rounding only, not mechanics.
const EXERCISE_META: Record<string, ExerciseMeta> = {
  "Rotación externa con banda": { grupoMuscularPrimario: "hombro (manguito rotador)", gruposSecundarios: [], patronMovimiento: "CORRECTIVO", equipo: "BANDA", unilateral: true, incrementoMinimoKg: 2.5, alias: [] },
  "Press mancuernas agarre neutro": { grupoMuscularPrimario: "pecho", gruposSecundarios: ["tríceps", "hombro"], patronMovimiento: "EMPUJE_HORIZONTAL", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["press banca mancuernas", "press de banca con mancuernas"] },
  "Remo sentado en polea, agarre neutro": { grupoMuscularPrimario: "espalda", gruposSecundarios: ["bíceps"], patronMovimiento: "JALON_HORIZONTAL", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["remo en polea"] },
  "Jalón al pecho, agarre neutro": { grupoMuscularPrimario: "espalda (dorsal)", gruposSecundarios: ["bíceps"], patronMovimiento: "JALON_VERTICAL", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["jalón al pecho"] },
  "Face pull en polea": { grupoMuscularPrimario: "hombro posterior", gruposSecundarios: ["espalda alta"], patronMovimiento: "JALON_HORIZONTAL", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: [] },
  "Elevaciones laterales": { grupoMuscularPrimario: "hombro (deltoides lateral)", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 1, alias: [] },
  "Curl bíceps con mancuernas": { grupoMuscularPrimario: "bíceps", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 1, alias: ["curl bíceps"] },
  "Extensión de tríceps con cuerda": { grupoMuscularPrimario: "tríceps", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: [] },
  "Prensa de piernas": { grupoMuscularPrimario: "cuádriceps", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_RODILLA", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: ["prensa"] },
  "Peso muerto rumano con mancuernas": { grupoMuscularPrimario: "isquiotibiales", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_CADERA", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["rdl mancuernas"] },
  "Zancada búlgara": { grupoMuscularPrimario: "cuádriceps", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_RODILLA", equipo: "MANCUERNA", unilateral: true, incrementoMinimoKg: 2.5, alias: [] },
  "Curl femoral en máquina": { grupoMuscularPrimario: "isquiotibiales", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: [] },
  "Extensión de cuádriceps": { grupoMuscularPrimario: "cuádriceps", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: [] },
  "Elevación de talones": { grupoMuscularPrimario: "pantorrilla", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: ["gemelos de pie"] },
  "Plancha frontal": { grupoMuscularPrimario: "core", gruposSecundarios: [], patronMovimiento: "CORE", equipo: "PESO_CORPORAL", unilateral: false, incrementoMinimoKg: 2.5, alias: ["plank"] },
  "Press inclinado mancuernas neutro": { grupoMuscularPrimario: "pecho superior", gruposSecundarios: ["hombro", "tríceps"], patronMovimiento: "EMPUJE_HORIZONTAL", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["press inclinado"] },
  "Remo con mancuerna a una mano": { grupoMuscularPrimario: "espalda", gruposSecundarios: ["bíceps"], patronMovimiento: "JALON_HORIZONTAL", equipo: "MANCUERNA", unilateral: true, incrementoMinimoKg: 2.5, alias: ["remo unilateral"] },
  "Jalón al pecho o dominada asistida": { grupoMuscularPrimario: "espalda (dorsal)", gruposSecundarios: ["bíceps"], patronMovimiento: "JALON_VERTICAL", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["dominada asistida"] },
  "Press hombro mancuernas neutro": { grupoMuscularPrimario: "hombro", gruposSecundarios: ["tríceps"], patronMovimiento: "EMPUJE_VERTICAL", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["press militar mancuernas"] },
  "Curl martillo": { grupoMuscularPrimario: "bíceps", gruposSecundarios: ["antebrazo"], patronMovimiento: "AISLAMIENTO", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 1, alias: [] },
  "Extensión de tríceps sobre la cabeza": { grupoMuscularPrimario: "tríceps", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 1, alias: [] },
  "Sentadilla goblet o hack": { grupoMuscularPrimario: "cuádriceps", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_RODILLA", equipo: "MANCUERNA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["goblet squat"] },
  "Hip thrust": { grupoMuscularPrimario: "glúteo", gruposSecundarios: ["isquiotibiales"], patronMovimiento: "DOMINANTE_CADERA", equipo: "BARRA", unilateral: false, incrementoMinimoKg: 5, alias: [] },
  "Peso muerto rumano con barra": { grupoMuscularPrimario: "isquiotibiales", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_CADERA", equipo: "BARRA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["rdl barra"] },
  "Prensa a una pierna o step-up": { grupoMuscularPrimario: "cuádriceps", gruposSecundarios: ["glúteo"], patronMovimiento: "DOMINANTE_RODILLA", equipo: "MAQUINA", unilateral: true, incrementoMinimoKg: 5, alias: ["step up"] },
  "Curl femoral sentado": { grupoMuscularPrimario: "isquiotibiales", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: [] },
  "Elevación de talones sentado": { grupoMuscularPrimario: "pantorrilla", gruposSecundarios: [], patronMovimiento: "AISLAMIENTO", equipo: "MAQUINA", unilateral: false, incrementoMinimoKg: 5, alias: ["gemelos sentado"] },
  "Crunch en polea o rueda abdominal": { grupoMuscularPrimario: "core", gruposSecundarios: [], patronMovimiento: "CORE", equipo: "POLEA", unilateral: false, incrementoMinimoKg: 2.5, alias: ["rueda abdominal"] },
};

interface RawRow {
  nombre: string;
  series: number;
  reps: string;
  rir: number | null;
  descansoSeg: number;
  condicion?: string;
}

const SESSION_A: RawRow[] = [
  { nombre: "Rotación externa con banda", series: 2, reps: "15", rir: null, descansoSeg: 45 },
  { nombre: "Press mancuernas agarre neutro", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Remo sentado en polea, agarre neutro", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Jalón al pecho, agarre neutro", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Face pull en polea", series: 3, reps: "15", rir: 2, descansoSeg: 60 },
  { nombre: "Elevaciones laterales", series: 2, reps: "15", rir: 2, descansoSeg: 60 },
  { nombre: "Curl bíceps con mancuernas", series: 2, reps: "12", rir: 1, descansoSeg: 60 },
  { nombre: "Extensión de tríceps con cuerda", series: 2, reps: "12-15", rir: 1, descansoSeg: 60 },
];

const SESSION_B: RawRow[] = [
  { nombre: "Prensa de piernas", series: 3, reps: "12-15", rir: 3, descansoSeg: 120 },
  { nombre: "Peso muerto rumano con mancuernas", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Zancada búlgara", series: 2, reps: "12 c/pierna", rir: 2, descansoSeg: 90 },
  { nombre: "Curl femoral en máquina", series: 3, reps: "12-15", rir: 2, descansoSeg: 60 },
  { nombre: "Extensión de cuádriceps", series: 2, reps: "15", rir: 1, descansoSeg: 60 },
  { nombre: "Elevación de talones", series: 3, reps: "15-20", rir: 1, descansoSeg: 45 },
  { nombre: "Plancha frontal", series: 3, reps: "30-45 s", rir: null, descansoSeg: 45 },
];

const SESSION_C: RawRow[] = [
  { nombre: "Rotación externa con banda", series: 2, reps: "15", rir: null, descansoSeg: 45 },
  { nombre: "Press inclinado mancuernas neutro", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Remo con mancuerna a una mano", series: 3, reps: "12 c/lado", rir: 3, descansoSeg: 90 },
  { nombre: "Jalón al pecho o dominada asistida", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  {
    nombre: "Press hombro mancuernas neutro",
    series: 3,
    reps: "12-15",
    rir: 3,
    descansoSeg: 90,
    condicion: "solo a partir de la semana 3 y si no hubo molestia en el hombro",
  },
  { nombre: "Face pull en polea", series: 3, reps: "15", rir: 2, descansoSeg: 60 },
  { nombre: "Curl martillo", series: 2, reps: "12", rir: 1, descansoSeg: 60 },
  { nombre: "Extensión de tríceps sobre la cabeza", series: 2, reps: "12-15", rir: 1, descansoSeg: 60 },
];

const SESSION_D: RawRow[] = [
  { nombre: "Sentadilla goblet o hack", series: 3, reps: "12-15", rir: 3, descansoSeg: 120 },
  { nombre: "Hip thrust", series: 3, reps: "12-15", rir: 2, descansoSeg: 90 },
  { nombre: "Peso muerto rumano con barra", series: 3, reps: "10-12", rir: 3, descansoSeg: 120 },
  { nombre: "Prensa a una pierna o step-up", series: 2, reps: "12 c/pierna", rir: 2, descansoSeg: 90 },
  { nombre: "Curl femoral sentado", series: 3, reps: "12-15", rir: 2, descansoSeg: 60 },
  { nombre: "Elevación de talones sentado", series: 3, reps: "15-20", rir: 1, descansoSeg: 45 },
  { nombre: "Crunch en polea o rueda abdominal", series: 3, reps: "12-15", rir: 1, descansoSeg: 60 },
];

function parseReps(raw: string): { repsMin: number; repsMax: number | null; unidadReps: "REPS" | "SEGUNDOS"; notas: string | null } {
  const isSeconds = raw.trim().endsWith("s") && raw.includes("-");
  const porLado = raw.includes("c/pierna") || raw.includes("c/lado");
  const numeric = raw.replace(/[^0-9-]/g, "");

  if (isSeconds) {
    const [min, max] = numeric.split("-").map(Number);
    return { repsMin: min, repsMax: max, unidadReps: "SEGUNDOS", notas: null };
  }

  if (numeric.includes("-")) {
    const [min, max] = numeric.split("-").map(Number);
    return { repsMin: min, repsMax: max, unidadReps: "REPS", notas: porLado ? "por lado" : null };
  }

  const n = Number(numeric);
  return { repsMin: n, repsMax: n, unidadReps: "REPS", notas: porLado ? "por lado" : null };
}

async function main() {
  const existingBlocks = await prisma.block.count();
  if (existingBlocks > 0) {
    console.log("Ya hay bloques sembrados, no se reesembra. Usa `prisma migrate reset` para reiniciar.");
    return;
  }

  const user = await prisma.user.upsert({
    where: { email: "yo@alejandroaguilera.mx" },
    create: { email: "yo@alejandroaguilera.mx", nombre: "Alejandro", rol: "ATLETA" },
    update: {},
  });

  const exerciseByName = new Map<string, string>();
  for (const [nombre, meta] of Object.entries(EXERCISE_META)) {
    const ex = await prisma.exercise.create({
      data: {
        nombre,
        alias: meta.alias,
        grupoMuscularPrimario: meta.grupoMuscularPrimario,
        gruposSecundarios: meta.gruposSecundarios,
        patronMovimiento: meta.patronMovimiento,
        equipo: meta.equipo,
        unilateral: meta.unilateral,
        incrementoMinimoKg: meta.incrementoMinimoKg,
        esGlobal: true,
      },
    });
    exerciseByName.set(nombre, ex.id);
  }

  const block = await prisma.block.create({
    data: {
      atletaId: user.id,
      nombre: "Bloque 1 — Reintroducción y base",
      fechaInicio: new Date("2026-07-31"),
      fechaFin: new Date("2026-08-27"),
      estado: "ACTIVO",
      notas: "Reintroducción y base. Fuente: 01-PLAN-ENTRENAMIENTO.md",
      weekOverrides: {
        create: [
          { numeroSemana: 1, deltaSeries: 0, rirObjetivo: 3, nota: "RIR 3-4" },
          { numeroSemana: 2, deltaSeries: 0, rirObjetivo: 2, nota: "RIR 2-3" },
          { numeroSemana: 3, deltaSeries: 0, rirObjetivo: 1, nota: "RIR 1-2 (+1 serie en compuestos)" },
          { numeroSemana: 4, deltaSeries: 0, rirObjetivo: 1, nota: "RIR 1-2" },
        ],
      },
    },
  });

  const sessions: { clave: string; nombre: string; rows: RawRow[] }[] = [
    { clave: "A", nombre: "Upper", rows: SESSION_A },
    { clave: "B", nombre: "Lower", rows: SESSION_B },
    { clave: "C", nombre: "Upper (variante)", rows: SESSION_C },
    { clave: "D", nombre: "Lower (variante)", rows: SESSION_D },
  ];

  for (const [i, session] of sessions.entries()) {
    await prisma.sessionTemplate.create({
      data: {
        blockId: block.id,
        clave: session.clave,
        nombre: session.nombre,
        orden: i,
        templateExercises: {
          create: session.rows.map((row, j) => {
            const { repsMin, repsMax, unidadReps, notas } = parseReps(row.reps);
            const exerciseId = exerciseByName.get(row.nombre);
            if (!exerciseId) throw new Error(`Ejercicio no encontrado: ${row.nombre}`);
            return {
              exerciseId,
              orden: j,
              seriesObjetivo: row.series,
              repsMin,
              repsMax,
              unidadReps,
              rirObjetivo: row.rir,
              descansoSeg: row.descansoSeg,
              notas,
              condicion: row.condicion ?? null,
            };
          }),
        },
      },
    });
  }

  console.log(`Sembrado: ${exerciseByName.size} ejercicios, 1 bloque, ${sessions.length} sesiones.`);

  // ~75 synthetic BodyMetric rows, Jan-Jul 2026, weight trending 88→82kg
  // with daily noise — the real Omron CSV referenced in §11 doesn't exist
  // in this environment, so this stands in for it (agreed with the user).
  const rand = mulberry32(20260731);
  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-07-31");
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  const N = 75;

  const bodyMetrics = [];
  for (let i = 0; i < N; i++) {
    const dayOffset = Math.round((i * totalDays) / (N - 1));
    const fecha = new Date(startDate.getTime() + dayOffset * 86_400_000);
    const progress = i / (N - 1);
    const trend = 88 - progress * 6; // 88kg -> 82kg
    const noise = (rand() - 0.5) * 0.8; // ±0.4kg
    const pesoKg = Math.round((trend + noise) * 10) / 10;

    bodyMetrics.push({
      atletaId: user.id,
      fecha,
      pesoKg,
      grasaPct: Math.round((22 - progress * 3 + (rand() - 0.5)) * 10) / 10,
      grasaVisceral: Math.round(9 - progress * 1.5),
      fuente: "OMRON_CSV" as const,
    });
  }

  await prisma.bodyMetric.createMany({ data: bodyMetrics });
  console.log(`Sembradas ${bodyMetrics.length} mediciones corporales sintéticas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
