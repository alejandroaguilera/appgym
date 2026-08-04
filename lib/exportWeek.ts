import { APP_TIME_ZONE, localDayString, localDateRangeBounds } from "@/lib/date";

const SEMANA_ISO = /^(\d{4})-W(\d{2})$/;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Lunes de la semana ISO `w` del año `y`, como día calendario "YYYY-MM-DD".
// Regla ISO 8601: el 4 de enero siempre cae dentro de la semana 1, así que el
// lunes de la semana 1 es el 4 de enero menos su día de la semana (base lunes).
function lunesDeSemanaISO(y: number, w: number): string {
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const diaSemana = (jan4.getUTCDay() + 6) % 7; // 0 = lunes
  const lunesSemana1 = jan4.getTime() - diaSemana * 86_400_000;
  return new Date(lunesSemana1 + (w - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

// Lunes de la semana que contiene el día calendario `dia` ("YYYY-MM-DD").
function lunesDeLaSemanaDe(dia: string): string {
  const d = new Date(`${dia}T00:00:00.000Z`);
  const diaSemana = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return new Date(d.getTime() - diaSemana * 86_400_000).toISOString().slice(0, 10);
}

// Semana ISO (lunes-domingo) que contiene la fecha dada — compartido por todos
// los endpoints de export que aceptan `?semana=`.
//
// Acepta el identificador de semana ISO ("2026-W32", que es lo que manda el
// script de export del hub) o un día suelto ("2026-08-05"); sin parámetro, la
// semana de hoy. `new Date("2026-W32")` es Invalid Date — JS no parsea semanas
// ISO — y ese NaN llegaba hasta Prisma como un DateTime inválido, que es lo que
// devolvía 500. Ante una entrada no reconocida se devuelve null y el caller
// responde 400.
//
// Los límites son [desde, hasta) en huso local, no UTC: un lunes 00:00 UTC es
// domingo 6 p.m. en México, así que la ventana anterior metía los
// entrenamientos de domingo por la tarde en la semana equivocada.
export function computeWeekRange(dateStr?: string | null): { desde: Date; hasta: Date } | null {
  let lunes: string;

  if (!dateStr) {
    lunes = lunesDeLaSemanaDe(localDayString());
  } else if (SEMANA_ISO.test(dateStr)) {
    const [, y, w] = SEMANA_ISO.exec(dateStr)!;
    const semana = Number(w);
    if (semana < 1 || semana > 53) return null;
    lunes = lunesDeSemanaISO(Number(y), semana);
  } else if (DIA_ISO.test(dateStr) && !Number.isNaN(new Date(`${dateStr}T00:00:00.000Z`).getTime())) {
    lunes = lunesDeLaSemanaDe(dateStr);
  } else {
    return null;
  }

  const domingo = new Date(`${lunes}T00:00:00.000Z`).getTime() + 6 * 86_400_000;
  const { gte, lt } = localDateRangeBounds(lunes, new Date(domingo).toISOString().slice(0, 10), APP_TIME_ZONE);
  if (!gte || !lt) return null;

  return { desde: gte, hasta: lt };
}
