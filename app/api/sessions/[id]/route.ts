import { NextRequest, NextResponse } from "next/server";
import { upsertSessionLog } from "@/lib/services/sessionLog";
import { detectAndSavePRs } from "@/lib/services/closeSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (body.id !== id) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }

  const sessionLog = await upsertSessionLog(body);

  let prs: Awaited<ReturnType<typeof detectAndSavePRs>> = [];
  if (sessionLog.estado === "COMPLETADA") {
    prs = await detectAndSavePRs(sessionLog.id, sessionLog.atletaId);
  }

  return NextResponse.json({ sessionLog, prs });
}
