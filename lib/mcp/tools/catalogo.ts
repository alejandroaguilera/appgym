import { prisma } from "@/lib/prisma";
import { kgALb } from "@/lib/mcp/units";

// SPEC §5.3. Existe porque las escrituras exigen `ejercicio_id` reales: sin
// esto el coach tendría que adivinar ids o inventar nombres, y un nombre
// inventado nunca debe crear un ejercicio en silencio.
export async function catalogoEjercicios(args: { busqueda?: string }) {
  const q = args.busqueda?.trim();

  const ejercicios = await prisma.exercise.findMany({
    where: q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { alias: { hasSome: [q] } },
            { grupoMuscularPrimario: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ grupoMuscularPrimario: "asc" }, { nombre: "asc" }],
  });

  return {
    total: ejercicios.length,
    busqueda: q ?? null,
    ejercicios: ejercicios.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      alias: e.alias,
      grupo_muscular_primario: e.grupoMuscularPrimario,
      grupos_secundarios: e.gruposSecundarios,
      patron_movimiento: e.patronMovimiento,
      equipo: e.equipo,
      unilateral: e.unilateral,
      // El salto de carga más chico que permite el equipo. Prescribir un peso
      // que no es múltiplo de esto es prescribir algo que no existe en el rack.
      incremento_minimo_lb: kgALb(e.incrementoMinimoKg),
    })),
  };
}
