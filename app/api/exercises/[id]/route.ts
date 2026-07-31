import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exercisePatchSchema } from "@/lib/validation/exercise";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = exercisePatchSchema.parse(body);
  const exercise = await prisma.exercise.update({ where: { id }, data });
  return NextResponse.json({ exercise });
}
