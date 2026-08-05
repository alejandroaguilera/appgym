interface SessionTemplateLite {
  id: string;
  clave: string;
  orden: number;
}

// Sessions are interchangeable, not day-locked (spec §3 note): "today's
// session" is just the next one in A→B→C→D order after whichever was last
// completed, with no calendar/ScheduledSession involved in this build.
export function nextSessionTemplate(
  templates: SessionTemplateLite[],
  lastCompletedTemplateId: string | null
): SessionTemplateLite {
  const sorted = [...templates].sort((a, b) => a.orden - b.orden);
  if (!lastCompletedTemplateId) return sorted[0];
  const idx = sorted.findIndex((t) => t.id === lastCompletedTemplateId);
  if (idx === -1) return sorted[0];
  return sorted[(idx + 1) % sorted.length];
}

// Dentro de un ciclo de semana, la sugerida es la primera plantilla por orden
// que todavía no se completó — no la siguiente en la rotación global. Con la
// rotación sola, "Hoy toca" podía apuntar a una sesión ya hecha en la semana.
// Si ya están todas, cae a la rotación: es el estado de semana completa, donde
// el atleta ve el overlay de cierre en vez de una sugerencia.
export function siguienteEnCiclo(
  templates: SessionTemplateLite[],
  completedTemplateIds: string[],
  lastCompletedTemplateId: string | null
): SessionTemplateLite {
  const sorted = [...templates].sort((a, b) => a.orden - b.orden);
  return (
    sorted.find((t) => !completedTemplateIds.includes(t.id)) ??
    nextSessionTemplate(sorted, lastCompletedTemplateId)
  );
}

// Semana por calendario. Sólo sobrevive como fallback del export para bloques
// sin WeekCycle — la app ya no la usa para decidir en qué semana estás.
export function weekNumberForDate(fechaInicio: Date, date: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = date.getTime() - fechaInicio.getTime();
  return Math.max(1, Math.floor(diff / msPerWeek) + 1);
}
