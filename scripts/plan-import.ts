// Importa un plan editado por fuera y lo publica en el bloque.
//
//   npx tsx scripts/plan-import.ts _plan-bloque-1.json            # diff, no escribe nada
//   npx tsx scripts/plan-import.ts _plan-bloque-1.json --apply    # publica
//   ... [--block <id>] [--force]
//
// Antes de tocar nada guarda un respaldo del estado actual: PUT /api/blocks/[id]
// borra y recrea plantillas, ejercicios y overrides en una transacción, así que
// no hay "deshacer" del lado del servidor.

import { readFileSync, writeFileSync } from "node:fs";
import { blockSchema } from "../lib/validation/block";
import {
  api,
  bloqueAPlan,
  getBloqueActivo,
  normalizar,
  repsTexto,
  type ApiBlock,
  type ApiExercise,
  type PlanExercise,
  type PlanFile,
} from "./plan-io";

// ── Resolución de ejercicios ─────────────────────────────────────────────

interface Nuevo {
  nombre: string;
  def: NonNullable<PlanExercise["_nuevo"]>;
  placeholder: string;
}

interface Resolucion {
  plan: PlanFile;
  nuevos: Nuevo[];
  avisos: string[];
  errores: string[];
}

// El nombre manda sobre el `exerciseId`. Quien edita el archivo por fuera
// reescribe el nombre y se olvida de borrar el id — si el id ganara, el
// cambio se perdería en silencio, que es la peor falla posible aquí.
function resolver(plan: PlanFile, catalogo: ApiExercise[]): Resolucion {
  const porNombre = new Map<string, ApiExercise>();
  for (const e of catalogo) {
    porNombre.set(normalizar(e.nombre), e);
    for (const a of e.alias) porNombre.set(normalizar(a), e);
  }

  const nuevos: Nuevo[] = [];
  const avisos: string[] = [];
  const errores: string[] = [];
  const yaCreados = new Map<string, string>(); // nombre normalizado → placeholder

  const sessionTemplates = plan.sessionTemplates.map((st, si) => ({
    ...st,
    orden: si,
    templateExercises: st.templateExercises.map((te, i) => {
      const donde = `sesión ${st.clave} · #${i + 1}`;
      const nombre = te._ejercicio?.trim();

      if (!nombre) {
        errores.push(`${donde}: falta "_ejercicio" (el nombre del ejercicio)`);
        return { ...te, orden: i };
      }

      const clave = normalizar(nombre);
      const exacto = porNombre.get(clave);

      if (exacto) {
        if (te.exerciseId && te.exerciseId !== exacto.id) {
          avisos.push(`${donde}: "${nombre}" resolvió por nombre a ${exacto.nombre}, ignorando el exerciseId viejo`);
        }
        return { ...te, _ejercicio: exacto.nombre, exerciseId: exacto.id, orden: i };
      }

      // Coincidencia parcial: sólo vale si es única. Ambigua es un error, no
      // una adivinanza — "curl" pega con curl de bíceps y con curl femoral.
      const parciales = catalogo.filter(
        (e) => normalizar(e.nombre).includes(clave) || clave.includes(normalizar(e.nombre))
      );
      if (parciales.length === 1) {
        avisos.push(`${donde}: "${nombre}" resolvió por coincidencia parcial a ${parciales[0].nombre}`);
        return { ...te, _ejercicio: parciales[0].nombre, exerciseId: parciales[0].id, orden: i };
      }

      if (te._nuevo) {
        const faltantes = (["grupoMuscularPrimario", "patronMovimiento", "equipo"] as const).filter(
          (k) => !te._nuevo?.[k]
        );
        if (faltantes.length) {
          errores.push(`${donde}: "${nombre}" trae "_nuevo" incompleto, falta ${faltantes.join(", ")}`);
          return { ...te, orden: i };
        }
        const yaVisto = yaCreados.get(clave);
        if (yaVisto) return { ...te, exerciseId: yaVisto, orden: i };

        const placeholder = `__NUEVO_${nuevos.length}__`;
        yaCreados.set(clave, placeholder);
        nuevos.push({ nombre, def: te._nuevo, placeholder });
        return { ...te, exerciseId: placeholder, orden: i };
      }

      const sugerencias = parciales.length
        ? parciales.map((e) => e.nombre)
        : masParecidos(clave, catalogo);
      errores.push(
        `${donde}: "${nombre}" no está en el catálogo.\n` +
          `      ¿Querías alguno de estos? ${sugerencias.join(" · ") || "(ninguno parecido)"}\n` +
          `      Si es un ejercicio nuevo de verdad, agrégale "_nuevo": { "grupoMuscularPrimario": …, "patronMovimiento": …, "equipo": … }`
      );
      return { ...te, orden: i };
    }),
  }));

  return { plan: { ...plan, sessionTemplates }, nuevos, avisos, errores };
}

// Preposiciones y artículos fuera: sin esto "press de banca con barra" sugería
// cualquier ejercicio que llevara "con" o "de" en el nombre, que es todo.
const VACIAS = new Set(["de", "del", "con", "en", "a", "al", "por", "la", "el", "los", "las", "o", "y", "un", "una"]);

function masParecidos(clave: string, catalogo: ApiExercise[]): string[] {
  const palabras = new Set(clave.split(" ").filter((p) => !VACIAS.has(p)));
  return catalogo
    .map((e) => ({
      nombre: e.nombre,
      puntos: normalizar(e.nombre)
        .split(" ")
        .filter((p) => !VACIAS.has(p) && palabras.has(p)).length,
    }))
    .filter((c) => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 3)
    .map((c) => c.nombre);
}

// ── Diff ─────────────────────────────────────────────────────────────────

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

function resumen(e: PlanExercise): string {
  const rir = e.rirObjetivo == null ? "RIR —" : `RIR ${e.rirObjetivo}`;
  return `${e.seriesObjetivo}×${repsTexto(e)} · ${rir} · ${e.descansoSeg}s`;
}

// Empareja por nombre dentro de la sesión (con índice de ocurrencia, por si
// el mismo ejercicio aparece dos veces), no por posición: mover un ejercicio
// de lugar no debe leerse como "se cambiaron todos los de abajo".
function clavesDeEjercicio(lista: PlanExercise[]): Map<string, PlanExercise> {
  const vistos = new Map<string, number>();
  const salida = new Map<string, PlanExercise>();
  for (const e of lista) {
    const base = normalizar(e._ejercicio ?? "");
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    salida.set(n > 1 ? `${base}#${n}` : base, e);
  }
  return salida;
}

function diff(viejo: PlanFile, nuevo: PlanFile): string[] {
  const out: string[] = [];

  for (const campo of ["nombre", "fechaInicio", "fechaFin", "estado", "notas"] as const) {
    if (fmt(viejo[campo]) !== fmt(nuevo[campo])) {
      const corto = (v: unknown) => (fmt(v).length > 60 ? fmt(v).slice(0, 57) + "…" : fmt(v));
      out.push(`bloque.${campo}: ${corto(viejo[campo])} → ${corto(nuevo[campo])}`);
    }
  }

  const semanas = new Set([
    ...viejo.weekOverrides.map((o) => o.numeroSemana),
    ...nuevo.weekOverrides.map((o) => o.numeroSemana),
  ]);
  for (const n of [...semanas].sort((a, b) => a - b)) {
    const v = viejo.weekOverrides.find((o) => o.numeroSemana === n);
    const x = nuevo.weekOverrides.find((o) => o.numeroSemana === n);
    if (v && !x) out.push(`semana ${n}: se elimina`);
    else if (!v && x) out.push(`semana ${n}: se agrega (RIR ${fmt(x.rirObjetivo)}, ${x.deltaSeries >= 0 ? "+" : ""}${x.deltaSeries} series, "${fmt(x.nota)}")`);
    else if (v && x) {
      for (const campo of ["rirObjetivo", "deltaSeries", "nota"] as const) {
        if (fmt(v[campo]) !== fmt(x[campo])) out.push(`semana ${n}.${campo}: ${fmt(v[campo])} → ${fmt(x[campo])}`);
      }
    }
  }

  const claves = new Set([...viejo.sessionTemplates.map((s) => s.clave), ...nuevo.sessionTemplates.map((s) => s.clave)]);
  for (const clave of [...claves].sort()) {
    const v = viejo.sessionTemplates.find((s) => s.clave === clave);
    const x = nuevo.sessionTemplates.find((s) => s.clave === clave);
    if (v && !x) {
      out.push(`sesión ${clave} (${v.nombre}): SE ELIMINA con sus ${v.templateExercises.length} ejercicios`);
      continue;
    }
    if (!v && x) {
      out.push(`sesión ${clave} (${x.nombre}): SE AGREGA con ${x.templateExercises.length} ejercicios`);
      for (const e of x.templateExercises) out.push(`  + ${e._ejercicio} — ${resumen(e)}`);
      continue;
    }
    if (!v || !x) continue;

    const lineas: string[] = [];
    if (v.nombre !== x.nombre) lineas.push(`  nombre: ${v.nombre} → ${x.nombre}`);
    if (fmt(v.notas) !== fmt(x.notas)) lineas.push(`  notas: ${fmt(v.notas)} → ${fmt(x.notas)}`);
    if (fmt(v.duracionEstimadaMin) !== fmt(x.duracionEstimadaMin)) {
      lineas.push(`  duración: ${fmt(v.duracionEstimadaMin)} → ${fmt(x.duracionEstimadaMin)}`);
    }

    const mapaV = clavesDeEjercicio(v.templateExercises);
    const mapaX = clavesDeEjercicio(x.templateExercises);
    for (const [k, ev] of mapaV) {
      if (!mapaX.has(k)) lineas.push(`  − ${ev._ejercicio} — ${resumen(ev)}`);
    }
    for (const [k, ex] of mapaX) {
      const ev = mapaV.get(k);
      if (!ev) {
        lineas.push(`  + ${ex._ejercicio} — ${resumen(ex)}`);
        continue;
      }
      const cambios: string[] = [];
      if (ev.seriesObjetivo !== ex.seriesObjetivo) cambios.push(`series ${ev.seriesObjetivo} → ${ex.seriesObjetivo}`);
      if (repsTexto(ev) !== repsTexto(ex)) cambios.push(`reps ${repsTexto(ev)} → ${repsTexto(ex)}`);
      if (fmt(ev.rirObjetivo) !== fmt(ex.rirObjetivo)) cambios.push(`RIR ${fmt(ev.rirObjetivo)} → ${fmt(ex.rirObjetivo)}`);
      if (ev.descansoSeg !== ex.descansoSeg) cambios.push(`descanso ${ev.descansoSeg}s → ${ex.descansoSeg}s`);
      if (fmt(ev.notas) !== fmt(ex.notas)) cambios.push(`notas: ${fmt(ev.notas)} → ${fmt(ex.notas)}`);
      if (ev.esOpcional !== ex.esOpcional) cambios.push(`opcional ${ev.esOpcional} → ${ex.esOpcional}`);
      if (fmt(ev.agrupacion) !== fmt(ex.agrupacion)) cambios.push(`agrupación ${fmt(ev.agrupacion)} → ${fmt(ex.agrupacion)}`);
      if (fmt(ev.condicion) !== fmt(ex.condicion)) cambios.push(`condición ${fmt(ev.condicion)} → ${fmt(ex.condicion)}`);
      if (ev.orden !== ex.orden) cambios.push(`posición ${ev.orden} → ${ex.orden}`);
      if (cambios.length) lineas.push(`  ~ ${ex._ejercicio}: ${cambios.join(", ")}`);
    }

    if (lineas.length) {
      out.push(`sesión ${clave} (${x.nombre}):`);
      out.push(...lineas);
    }
  }

  return out;
}

// ── Payload para el PUT ──────────────────────────────────────────────────

function aPayload(plan: PlanFile) {
  return {
    nombre: plan.nombre,
    fechaInicio: plan.fechaInicio,
    fechaFin: plan.fechaFin,
    estado: plan.estado,
    notas: plan.notas,
    weekOverrides: plan.weekOverrides.map((o) => ({
      numeroSemana: o.numeroSemana,
      deltaSeries: o.deltaSeries ?? 0,
      rirObjetivo: o.rirObjetivo ?? null,
      nota: o.nota ?? null,
    })),
    sessionTemplates: plan.sessionTemplates.map((st) => ({
      clave: st.clave,
      nombre: st.nombre,
      orden: st.orden,
      notas: st.notas ?? null,
      duracionEstimadaMin: st.duracionEstimadaMin ?? null,
      // Aquí se caen las claves `_`: lo que se guarda es sólo lo que
      // `blockSchema` conoce.
      templateExercises: st.templateExercises.map((te) => ({
        exerciseId: te.exerciseId ?? "",
        orden: te.orden,
        seriesObjetivo: te.seriesObjetivo,
        repsMin: te.repsMin,
        repsMax: te.repsMax ?? null,
        unidadReps: te.unidadReps ?? "REPS",
        rirObjetivo: te.rirObjetivo ?? null,
        descansoSeg: te.descansoSeg,
        notas: te.notas ?? null,
        agrupacion: te.agrupacion ?? null,
        esOpcional: te.esOpcional ?? false,
        condicion: te.condicion ?? null,
      })),
    })),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const force = args.includes("--force");
  const iBlock = args.indexOf("--block");
  const blockArg = iBlock >= 0 ? args[iBlock + 1] : undefined;
  const archivo = args.find((a, i) => !a.startsWith("--") && !(iBlock >= 0 && i === iBlock + 1));

  if (!archivo) {
    console.error("Uso: npx tsx scripts/plan-import.ts <archivo.json> [--apply] [--force] [--block <id>]");
    process.exit(1);
  }

  const plan = JSON.parse(readFileSync(archivo, "utf-8")) as PlanFile;
  const blockId = blockArg ?? plan._blockId ?? (await getBloqueActivo());

  const { block } = await api<{ block: ApiBlock }>(`/api/blocks/${blockId}`);
  const actual = bloqueAPlan(block);

  // Respaldo antes que nada, incluso en dry-run: es barato y el PUT no se
  // puede deshacer.
  const respaldo = `${archivo.replace(/\.json$/, "")}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(respaldo, JSON.stringify({ _blockId: block.id, ...actual }, null, 2) + "\n", "utf-8");

  const { exercises } = await api<{ exercises: ApiExercise[] }>("/api/exercises");
  const resuelto = resolver(plan, exercises);

  console.log(`Bloque destino: ${block.nombre} (${block.estado}) — ${block.id}`);
  console.log(`Respaldo del estado actual: ${respaldo}\n`);

  for (const a of resuelto.avisos) console.log(`aviso · ${a}`);
  if (resuelto.avisos.length) console.log("");

  if (resuelto.errores.length) {
    console.error(`No se importó nada. ${resuelto.errores.length} problema(s):\n`);
    for (const e of resuelto.errores) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  if (resuelto.nuevos.length) {
    console.log(`Ejercicios nuevos que se darán de alta en el catálogo (${resuelto.nuevos.length}):`);
    for (const n of resuelto.nuevos) {
      console.log(`  + ${n.nombre} — ${n.def.grupoMuscularPrimario} · ${n.def.patronMovimiento} · ${n.def.equipo}`);
    }
    console.log("");
  }

  // Se valida contra el mismo esquema del endpoint antes de mandar nada, para
  // que un campo mal escrito salga aquí con su ruta exacta y no como un 500.
  const validacion = blockSchema.safeParse(aPayload(resuelto.plan));
  if (!validacion.success) {
    console.error("No se importó nada. El archivo no pasa la validación del bloque:\n");
    for (const p of validacion.error.issues) {
      console.error(`  ✗ ${p.path.join(".")}: ${p.message}`);
    }
    process.exit(1);
  }

  const cambios = diff(actual, resuelto.plan);
  if (!cambios.length) {
    console.log("Sin cambios: el archivo es idéntico al plan que ya está guardado.");
    return;
  }
  console.log(`Cambios (${cambios.length}):`);
  for (const c of cambios) console.log(c.startsWith(" ") ? c : `  ${c}`);
  console.log("");

  // El PUT recrea las SessionTemplate con ids nuevos, y `/api/today` cuenta
  // lo completado del ciclo abierto filtrando por los ids del bloque
  // (app/api/today/route.ts). Si ya se entrenó algo esta semana, importar
  // ahora la regresaría a cero. El historial de SessionLog/SetLog no se
  // pierde nunca — la referencia no es FK — pero el avance de la semana sí.
  const hoy = await api<{ block: { id: string } | null; numeroSemana?: number; completedTemplateIds?: string[] }>(
    "/api/today"
  );
  const yaEntrenado = hoy.block?.id === block.id ? (hoy.completedTemplateIds ?? []).length : 0;
  if (yaEntrenado > 0) {
    console.log(
      `⚠ La semana ${hoy.numeroSemana} ya tiene ${yaEntrenado} sesión(es) completada(s).\n` +
        `  Importar ahora reinicia el avance de esta semana (el historial NO se pierde).\n` +
        `  Si aun así quieres hacerlo, agrega --force.`
    );
    if (!force) process.exit(1);
  }

  if (!apply) {
    console.log("Dry-run: no se escribió nada. Corre otra vez con --apply para publicarlo.");
    return;
  }

  // Alta de los ejercicios nuevos y sustitución de los placeholders.
  const idsReales = new Map<string, string>();
  for (const n of resuelto.nuevos) {
    const { exercise } = await api<{ exercise: ApiExercise }>("/api/exercises", {
      method: "POST",
      body: JSON.stringify({ nombre: n.nombre, ...n.def }),
    });
    idsReales.set(n.placeholder, exercise.id);
    console.log(`Ejercicio creado: ${exercise.nombre} (${exercise.id})`);
  }
  for (const st of resuelto.plan.sessionTemplates) {
    for (const te of st.templateExercises) {
      if (te.exerciseId && idsReales.has(te.exerciseId)) te.exerciseId = idsReales.get(te.exerciseId)!;
    }
  }

  const payload = blockSchema.parse(aPayload(resuelto.plan));
  await api(`/api/blocks/${block.id}`, { method: "PUT", body: JSON.stringify(payload) });

  const { block: verificado } = await api<{ block: ApiBlock }>(`/api/blocks/${block.id}`);
  const restante = diff(bloqueAPlan(verificado), resuelto.plan);
  if (restante.length) {
    console.error("\n⚠ El bloque guardado no coincide con el archivo:");
    for (const c of restante) console.error(c);
    process.exit(1);
  }
  console.log(`\n✓ Publicado en ${block.nombre}. Verificado contra la API: coincide.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
