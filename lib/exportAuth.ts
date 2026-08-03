import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteId } from "@/lib/athlete";

// Único patrón de auth por header en la app — no existía ninguno antes.
// Single-user: no hace falta resolver "qué atleta" por token, el token
// simplemente confirma que quien llama tiene permiso de leer los datos del
// único atleta que existe (spec §7.1: "token de solo lectura... revocable").
export async function requireExportToken(req: NextRequest): Promise<string | NextResponse> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "falta el header Authorization: Bearer <token>" }, { status: 401 });
  }

  const atletaId = await getAthleteId();
  const user = await prisma.user.findUnique({ where: { id: atletaId }, select: { exportToken: true } });

  if (!user?.exportToken || user.exportToken !== token) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  return atletaId;
}
