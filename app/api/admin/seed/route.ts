import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/services/seedDatabase";

// One-time bootstrap endpoint: this environment has no direct access to the
// production Postgres container to run `prisma db seed` over a shell, so
// seeding is triggered once over HTTPS instead. Idempotent (no-ops if a
// Block already exists) and gated behind SEED_TOKEN.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-seed-token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await seedDatabase(prisma);
  return NextResponse.json(result);
}
