// Semana ISO (lunes-domingo) que contiene la fecha dada — compartido por
// todos los endpoints de export que aceptan `?semana=`.
export function computeWeekRange(dateStr?: string | null): { desde: Date; hasta: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  const day = base.getUTCDay(); // 0=domingo..6=sábado
  const diffToMonday = (day + 6) % 7;
  const desde = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - diffToMonday, 0, 0, 0)
  );
  const hasta = new Date(desde.getTime() + 7 * 86_400_000 - 1);
  return { desde, hasta };
}
