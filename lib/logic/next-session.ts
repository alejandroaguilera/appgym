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

export function weekNumberForDate(fechaInicio: Date, date: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = date.getTime() - fechaInicio.getTime();
  return Math.max(1, Math.floor(diff / msPerWeek) + 1);
}
