-- CreateTable
CREATE TABLE "WeekCycle" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "numeroSemana" INTEGER NOT NULL,
    "iniciadaEn" TIMESTAMP(3) NOT NULL,
    "cerradaEn" TIMESTAMP(3),
    "mensaje" TEXT,
    "mensajeOrigen" TEXT,
    "celebradaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekCycle_blockId_cerradaEn_idx" ON "WeekCycle"("blockId", "cerradaEn");

-- CreateIndex
CREATE UNIQUE INDEX "WeekCycle_blockId_numeroSemana_key" ON "WeekCycle"("blockId", "numeroSemana");

-- AddForeignKey
ALTER TABLE "WeekCycle" ADD CONSTRAINT "WeekCycle_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: el ciclo 1 de cada bloque arranca en su fechaInicio, no en NOW().
-- Si arrancara en NOW(), las sesiones ya completadas quedarían fuera de la
-- ventana del ciclo abierto y seguirían sin marcarse como completadas — que es
-- exactamente el bug que esta migración existe para arreglar.
INSERT INTO "WeekCycle" ("id", "atletaId", "blockId", "numeroSemana", "iniciadaEn", "createdAt")
SELECT
    gen_random_uuid()::text,
    b."atletaId",
    b."id",
    1,
    b."fechaInicio",
    NOW()
FROM "Block" b
WHERE NOT EXISTS (SELECT 1 FROM "WeekCycle" w WHERE w."blockId" = b."id");
