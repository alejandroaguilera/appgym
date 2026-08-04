export const APP_TIME_ZONE = "America/Mexico_City";

// "Hoy" (o cualquier Date) como "YYYY-MM-DD" en el huso horario de la app —
// reemplaza el patrón `toISOString().slice(0,10)`, que usa UTC y puede
// desplazar la fecha calendario cerca de medianoche local.
export function localDayString(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date
  );
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}

// Límites [inicio, fin) en UTC del día calendario local que contiene `date` —
// para filtrar timestamps reales (ej. SessionLog.finalizadaEn) por "hoy".
export function localDayBounds(
  date: Date = new Date(),
  timeZone: string = APP_TIME_ZONE
): { start: Date; end: Date } {
  const offset = tzOffsetMs(date, timeZone);
  const dayStr = localDayString(date, timeZone);
  const startMs = new Date(`${dayStr}T00:00:00.000Z`).getTime() - offset;
  return { start: new Date(startMs), end: new Date(startMs + 86_400_000) };
}

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Medianoche local del día calendario `YYYY-MM-DD`, expresada en UTC.
// `new Date("2026-08-04")` da medianoche *UTC*, que en México (UTC-6) es en
// realidad el 3 de agosto a las 6 p.m. — usar eso como límite de un rango
// recorta seis horas del día equivocado.
function localMidnightUTC(dia: string, timeZone: string): Date | null {
  if (!DIA_ISO.test(dia)) return null;
  const tentativo = new Date(`${dia}T00:00:00.000Z`);
  if (Number.isNaN(tentativo.getTime())) return null;
  // Mismo despeje que localDayBounds: el offset se mide en el instante
  // tentativo y se resta. Basta una pasada porque el offset de un huso no
  // cambia dentro de la misma ventana de 24 h salvo en el salto de horario de
  // verano, donde la diferencia es de una hora y no cruza el día calendario.
  return new Date(tentativo.getTime() - tzOffsetMs(tentativo, timeZone));
}

// Rango [gte, lt) en UTC que cubre completos los días calendario locales
// `desde`..`hasta`. Semiabierto a propósito: `lte: new Date(hasta)` deja fuera
// el día `hasta` entero, que es como el export de sesiones perdía cualquier
// entrenamiento posterior a las 6 p.m. locales. Una clave ausente significa
// "sin límite por ese lado"; una fecha no parseable se ignora igual, para que
// nunca viaje un Invalid Date a Prisma (eso revienta la query con un 500).
export function localDateRangeBounds(
  desde?: string | null,
  hasta?: string | null,
  timeZone: string = APP_TIME_ZONE
): { gte?: Date; lt?: Date } {
  const rango: { gte?: Date; lt?: Date } = {};

  const inicio = desde ? localMidnightUTC(desde, timeZone) : null;
  if (inicio) rango.gte = inicio;

  const fin = hasta ? localMidnightUTC(hasta, timeZone) : null;
  if (fin) rango.lt = new Date(fin.getTime() + 86_400_000);

  return rango;
}

// Un instante real → la medianoche UTC del día calendario local que lo
// contiene, que es exactamente como se guarda una columna @db.Date (ej.
// BodyMetric.fecha). Necesario para comparar un límite de rango calculado en
// huso local contra esas columnas: el límite trae el offset del huso incrustado
// (lunes 00:00 en México es 06:00Z) y compararlo crudo contra una fecha
// guardada a 00:00Z se sale por un día.
export function toDateOnlyUTC(date: Date, timeZone: string = APP_TIME_ZONE): Date {
  return new Date(`${localDayString(date, timeZone)}T00:00:00.000Z`);
}

// Una columna @db.Date (ej. BodyMetric.fecha) viaja como ISO UTC-medianoche
// ("2026-08-03T00:00:00.000Z" *es* el 3 de agosto, sin ambigüedad). Formatear
// eso con un Intl.DateTimeFormat sin `timeZone` explícito cae en el huso del
// visor, y en cualquier huso detrás de UTC se ve un día antes. Se extraen los
// componentes Y-M-D tal como se guardaron y se reconstruye un Date a
// medianoche LOCAL, para que cualquier formateo/orden/comparación posterior
// sea consistente sin depender del huso del que lo mire.
export function dateOnlyToLocalDate(fecha: string | Date): Date {
  const iso = typeof fecha === "string" ? fecha : fecha.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
