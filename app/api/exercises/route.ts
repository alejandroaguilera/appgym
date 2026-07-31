import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Catalog is small (a few dozen rows), so alias substring matching (spec
// §3: "press banca" must find "press de banca con barra") is done in
// application code rather than fighting Prisma's exact-match array filters.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const all = await prisma.exercise.findMany({ orderBy: { nombre: "asc" } });
  const exercises = q
    ? all.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q) ||
          e.alias.some((a) => a.toLowerCase().includes(q))
      )
    : all;
  return NextResponse.json({ exercises });
}
