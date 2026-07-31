import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/services/seedDatabase";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then((result) => {
    if (result.skipped) {
      console.log("Ya hay bloques sembrados, no se reesembra. Usa `prisma migrate reset` para reiniciar.");
    } else {
      console.log(
        `Sembrado: ${result.exercisesCreated} ejercicios, ${result.sessionsCreated} sesiones, ${result.bodyMetricsCreated} mediciones corporales.`
      );
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
