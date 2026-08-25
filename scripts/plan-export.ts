// Exporta el bloque activo a un JSON editable fuera de la app.
//
//   npx tsx scripts/plan-export.ts [--block <id>] [--out <archivo>]
//
// El archivo resultante es el árbol exacto que consume PUT /api/blocks/[id],
// más claves `_` informativas (nombre del ejercicio, catálogo, instrucciones)
// que `plan-import.ts` ignora. Ver `scripts/plan-io.ts` para la forma.

import { writeFileSync } from "node:fs";
import { api, bloqueAPlan, getBloqueActivo, type ApiBlock, type ApiExercise, type PlanFile } from "./plan-io";

const INSTRUCCIONES = [
  "Este archivo es el plan completo del bloque. Edítalo y devuélveselo a Claude, o corre:",
  "  npx tsx scripts/plan-import.ts <este archivo>            # muestra el diff, no escribe nada",
  "  npx tsx scripts/plan-import.ts <este archivo> --apply    # lo publica",
  "",
  "Las claves que empiezan con _ son informativas y no se guardan.",
  "",
  "CÓMO EDITAR:",
  "- Cambiar un ejercicio por otro del catálogo (ver _catalogo al final): reescribe",
  "  \"_ejercicio\" con el nombre nuevo y BORRA su \"exerciseId\" — se resuelve por nombre o alias.",
  "- Agregar un ejercicio que NO está en el catálogo: agrega el objeto sin \"exerciseId\" y con",
  "  \"_nuevo\": { \"grupoMuscularPrimario\": \"hombro\", \"patronMovimiento\": \"EMPUJE_VERTICAL\", \"equipo\": \"MANCUERNA\" }",
  "  grupoMuscularPrimario: pecho | espalda | hombro | bíceps | tríceps | cuádriceps | isquiotibiales | glúteo | pantorrilla | core",
  "  patronMovimiento: EMPUJE_HORIZONTAL | EMPUJE_VERTICAL | JALON_HORIZONTAL | JALON_VERTICAL | DOMINANTE_RODILLA | DOMINANTE_CADERA | AISLAMIENTO | CORE | CORRECTIVO",
  "  equipo: BARRA | MANCUERNA | POLEA | MAQUINA | PESO_CORPORAL | BANDA",
  "- Quitar un ejercicio: borra el objeto. El \"orden\" se renumera solo al importar.",
  "- \"repsMax\": null significa reps fijas (usa \"repsMin\"). \"unidadReps\": \"SEGUNDOS\" para planchas y similares.",
  "- \"rirObjetivo\": null significa 'no aplica' (calentamientos, trabajo por tiempo). El RIR de la",
  "  semana NUNCA se le impone a un ejercicio con RIR null — si quieres que la progresión semanal",
  "  lo controle, ponle un número.",
  "- \"weekOverrides\" es lo único que varía por semana: rirObjetivo (el RIR de esa semana),",
  "  deltaSeries (+1 suma una serie a TODOS los ejercicios esa semana) y nota (el foco, se ve en Hoy).",
  "  No hay ejercicios distintos por semana: las plantillas de abajo son las mismas todas las semanas.",
  "- \"descansoSeg\" en segundos. \"esOpcional\": true lo marca como opcional en la app.",
];

async function main() {
  const args = process.argv.slice(2);
  const arg = (nombre: string) => {
    const i = args.indexOf(nombre);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const blockId = arg("--block") ?? (await getBloqueActivo());
  const { block } = await api<{ block: ApiBlock }>(`/api/blocks/${blockId}`);
  const { exercises } = await api<{ exercises: ApiExercise[] }>("/api/exercises");

  const plan: PlanFile = {
    _instrucciones: INSTRUCCIONES,
    _blockId: block.id,
    _exportadoEn: new Date().toISOString(),
    ...bloqueAPlan(block),
    // Al final a propósito: son ~30 filas de referencia y estorban arriba,
    // donde está lo que de verdad se edita.
    _catalogo: [...exercises]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        alias: e.alias,
        grupoMuscularPrimario: e.grupoMuscularPrimario,
        patronMovimiento: e.patronMovimiento,
        equipo: e.equipo,
      })),
  };

  const numero = /Bloque\s+(\d+)/i.exec(block.nombre)?.[1] ?? "activo";
  const out = arg("--out") ?? `_plan-bloque-${numero}.json`;
  writeFileSync(out, JSON.stringify(plan, null, 2) + "\n", "utf-8");

  const totalEjercicios = plan.sessionTemplates.reduce((n, s) => n + s.templateExercises.length, 0);
  console.log(`Exportado desde ${block.nombre} (${block.estado})`);
  console.log(
    `  ${plan.sessionTemplates.length} sesiones · ${totalEjercicios} ejercicios · ` +
      `${plan.weekOverrides.length} semanas · catálogo de ${exercises.length}`
  );
  for (const s of plan.sessionTemplates) {
    console.log(`  ${s.clave} — ${s.nombre}: ${s.templateExercises.length} ejercicios`);
  }
  console.log(`\n→ ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
