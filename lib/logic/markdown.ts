interface SetParaMarkdown {
  numeroSerie: number;
  pesoKg: number;
  reps: number;
  rir: number | null;
  notas: string | null;
  tipo: string;
}

interface EjercicioParaMarkdown {
  nombre: string;
  sets: SetParaMarkdown[];
  siguienteTexto: string; // ya resuelto por el caller (calcObjetivoHoy o el texto de fallback)
}

interface SesionParaMarkdown {
  fecha: string; // YYYY-MM-DD
  clave: string | null;
  nombre: string; // nombre de sesión o "Libre"
  duracionMin: number | null;
  energia1a5: number | null;
  suenoHoras: number | null;
  ejercicios: EjercicioParaMarkdown[];
  prsTexto: string;
  semanaNumero?: number | null; // semana dentro del bloque
  bloqueNombre?: string | null;
  // El modelo guarda `molestiaZona` libre, no una columna por zona: el caller
  // resuelve el texto (ej. "hombro 4/10") o pasa null para "no registrada".
  molestiaTexto?: string | null;
}

// Formato exacto del spec §7.2, para `02-LOG-ENTRENAMIENTO.md`.
export function generarMarkdownSesion(s: SesionParaMarkdown): string {
  const encabezado = s.clave ? `SESIÓN ${s.clave} · ${s.nombre.toUpperCase()}` : `SESIÓN LIBRE`;
  const contexto = [
    s.semanaNumero != null ? `Semana ${s.semanaNumero}` : null,
    s.bloqueNombre,
  ].filter(Boolean);
  const lineas: string[] = [
    `## ${s.fecha} — ${encabezado}${contexto.length ? ` · ${contexto.join(", ")}` : ""}`,
  ];

  const meta = [
    s.duracionMin != null ? `Duración: ${s.duracionMin} min` : null,
    s.energia1a5 != null ? `Energía: ${s.energia1a5}/5` : null,
    s.suenoHoras != null ? `Sueño previo: ${s.suenoHoras} h` : null,
  ].filter(Boolean);
  if (meta.length) lineas.push(meta.join(" | "));
  lineas.push(`Molestia: ${s.molestiaTexto ?? "no registrada"}`);
  lineas.push("");

  const maxSets = Math.max(1, ...s.ejercicios.map((e) => e.sets.length));
  const columnasSet = Array.from({ length: maxSets }, (_, i) => `S${i + 1}`);
  lineas.push(`| Ejercicio | ${columnasSet.join(" | ")} | RIR | Notas |`);
  lineas.push(`|${"---|".repeat(columnasSet.length + 3)}`);

  for (const ej of s.ejercicios) {
    const celdas = columnasSet.map((_, i) => {
      const set = ej.sets[i];
      if (!set) return "";
      return set.tipo === "CALENTAMIENTO" ? `${set.pesoKg}×${set.reps} (cal.)` : `${set.pesoKg}×${set.reps}`;
    });
    const ultimoRir = [...ej.sets].reverse().find((set) => set.rir != null)?.rir;
    const notas = ej.sets.map((set) => set.notas).filter(Boolean).join("; ");
    lineas.push(`| ${ej.nombre} | ${celdas.join(" | ")} | ${ultimoRir ?? "—"} | ${notas} |`);
  }

  lineas.push("");
  lineas.push(`PRs: ${s.prsTexto}`);
  lineas.push("Siguiente sesión:");
  for (const ej of s.ejercicios) {
    lineas.push(`- ${ej.nombre}: ${ej.siguienteTexto}`);
  }

  return lineas.join("\n");
}

interface ResumenSemanalParaMarkdown {
  desde: string;
  hasta: string;
  sesionesCompletadas: number;
  sesionesProgramadas: number | null;
  volumenTotalKg: number;
  pesoInicioSemana: number | null;
  pesoFinSemana: number | null;
  prsTexto: string;
  banderasTexto: string;
}

// Formato del spec §7.2, para `06-CHECKINS.md`.
export function generarMarkdownResumenSemanal(r: ResumenSemanalParaMarkdown): string {
  const deltaTexto =
    r.pesoInicioSemana != null && r.pesoFinSemana != null
      ? `${r.pesoFinSemana > r.pesoInicioSemana ? "+" : ""}${Math.round((r.pesoFinSemana - r.pesoInicioSemana) * 10) / 10} kg`
      : "—";

  const lineas = [
    `## Resumen semanal — ${r.desde} a ${r.hasta}`,
    "",
    `Sesiones completadas: ${r.sesionesCompletadas}${r.sesionesProgramadas != null ? `/${r.sesionesProgramadas}` : ""}`,
    `Volumen total: ${Math.round(r.volumenTotalKg)} kg`,
    "",
    "| Métrica | Inicio semana | Fin semana | Tendencia |",
    "|---|---|---|---|",
    `| Peso (kg) | ${r.pesoInicioSemana ?? "—"} | ${r.pesoFinSemana ?? "—"} | ${deltaTexto} |`,
    "",
    `PRs: ${r.prsTexto}`,
    `Banderas: ${r.banderasTexto}`,
  ];

  return lineas.join("\n");
}
