-- La prescripción semanal por ejercicio. Ver el comentario del modelo en
-- schema.prisma: es lo que le pone fecha de caducidad a una prescripción, que
-- antes vivía en la nota de texto de TemplateExercise y nunca expiraba.
--
-- Sin backfill a propósito: una tabla vacía significa "ninguna semana tiene
-- prescripción del coach", y la app cae al cálculo automático de siempre. Es
-- exactamente el comportamiento actual, así que el deploy no cambia nada hasta
-- que el coach escriba la primera semana.
CREATE TABLE "WeekPrescription" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "numeroSemana" INTEGER NOT NULL,
    "sessionTemplateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "seriesObjetivo" INTEGER NOT NULL,
    "repsMin" INTEGER NOT NULL,
    "repsMax" INTEGER,
    "rirObjetivo" INTEGER,
    "pesoObjetivoKg" DOUBLE PRECISION,
    "descansoSeg" INTEGER,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekPrescription_pkey" PRIMARY KEY ("id")
);

-- Idempotencia de ajustar_semana: llamarla dos veces sobre la misma semana
-- tiene que dejar un ajuste, no dos (SPEC §6.8). Este unique es la guarda real.
CREATE UNIQUE INDEX "WeekPrescription_blockId_numeroSemana_sessionTemplateId_exe_key"
    ON "WeekPrescription"("blockId", "numeroSemana", "sessionTemplateId", "exerciseId");

CREATE INDEX "WeekPrescription_blockId_numeroSemana_idx"
    ON "WeekPrescription"("blockId", "numeroSemana");

ALTER TABLE "WeekPrescription" ADD CONSTRAINT "WeekPrescription_blockId_fkey"
    FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeekPrescription" ADD CONSTRAINT "WeekPrescription_sessionTemplateId_fkey"
    FOREIGN KEY ("sessionTemplateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeekPrescription" ADD CONSTRAINT "WeekPrescription_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
