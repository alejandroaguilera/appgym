import { prisma } from "@/lib/prisma";

let cachedAthleteId: string | null = null;

// App is single-athlete for now (no auth). Resolves the one seeded User row.
export async function getAthleteId(): Promise<string> {
  if (cachedAthleteId) return cachedAthleteId;
  const user = await prisma.user.findFirstOrThrow();
  cachedAthleteId = user.id;
  return cachedAthleteId;
}
