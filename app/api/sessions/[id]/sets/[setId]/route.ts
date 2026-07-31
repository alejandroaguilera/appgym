import { NextRequest, NextResponse } from "next/server";
import { upsertSetLog, deleteSetLog } from "@/lib/services/setLog";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const { id, setId } = await params;
  const body = await req.json();
  if (body.id !== setId) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }
  const setLog = await upsertSetLog(id, body);
  return NextResponse.json({ setLog });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const { setId } = await params;
  await deleteSetLog(setId);
  return NextResponse.json({ ok: true });
}
