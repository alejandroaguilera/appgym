-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ATLETA', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "UnidadPeso" AS ENUM ('KG', 'LB');

-- CreateEnum
CREATE TYPE "PatronMovimiento" AS ENUM ('EMPUJE_HORIZONTAL', 'EMPUJE_VERTICAL', 'JALON_HORIZONTAL', 'JALON_VERTICAL', 'DOMINANTE_RODILLA', 'DOMINANTE_CADERA', 'AISLAMIENTO', 'CORE', 'CORRECTIVO');

-- CreateEnum
CREATE TYPE "Equipo" AS ENUM ('BARRA', 'MANCUERNA', 'POLEA', 'MAQUINA', 'PESO_CORPORAL', 'BANDA');

-- CreateEnum
CREATE TYPE "UnidadReps" AS ENUM ('REPS', 'SEGUNDOS');

-- CreateEnum
CREATE TYPE "EstadoBlock" AS ENUM ('BORRADOR', 'ACTIVO', 'COMPLETADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoScheduled" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'OMITIDA', 'REPROGRAMADA');

-- CreateEnum
CREATE TYPE "EstadoSessionLog" AS ENUM ('EN_PROGRESO', 'COMPLETADA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "TipoSet" AS ENUM ('TRABAJO', 'CALENTAMIENTO', 'DROPSET', 'FALLO');

-- CreateEnum
CREATE TYPE "TipoPR" AS ENUM ('PESO_MAX', 'REPS_A_PESO', 'E1RM', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "FuenteMetric" AS ENUM ('MANUAL', 'OMRON_CSV', 'API');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'ATLETA',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "unidadPeso" "UnidadPeso" NOT NULL DEFAULT 'KG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias" TEXT[],
    "grupoMuscularPrimario" TEXT NOT NULL,
    "gruposSecundarios" TEXT[],
    "patronMovimiento" "PatronMovimiento" NOT NULL,
    "equipo" "Equipo" NOT NULL,
    "unilateral" BOOLEAN NOT NULL DEFAULT false,
    "incrementoMinimoKg" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "esGlobal" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorUserId" TEXT,
    "instrucciones" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "creadoPorUserId" TEXT,
    "nombre" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "estado" "EstadoBlock" NOT NULL DEFAULT 'BORRADOR',
    "notas" TEXT,
    "criteriosProgresion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "notas" TEXT,
    "duracionEstimadaMin" INTEGER,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateExercise" (
    "id" TEXT NOT NULL,
    "sessionTemplateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "seriesObjetivo" INTEGER NOT NULL,
    "repsMin" INTEGER NOT NULL,
    "repsMax" INTEGER,
    "unidadReps" "UnidadReps" NOT NULL DEFAULT 'REPS',
    "rirObjetivo" INTEGER,
    "descansoSeg" INTEGER NOT NULL,
    "notas" TEXT,
    "agrupacion" TEXT,
    "esOpcional" BOOLEAN NOT NULL DEFAULT false,
    "condicion" TEXT,

    CONSTRAINT "TemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekOverride" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "numeroSemana" INTEGER NOT NULL,
    "deltaSeries" INTEGER NOT NULL DEFAULT 0,
    "rirObjetivo" INTEGER,
    "nota" TEXT,

    CONSTRAINT "WeekOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSession" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sessionTemplateId" TEXT NOT NULL,
    "fechaProgramada" DATE NOT NULL,
    "numeroSemana" INTEGER NOT NULL,
    "estado" "EstadoScheduled" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "ScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "scheduledSessionId" TEXT,
    "sessionTemplateId" TEXT,
    "iniciadaEn" TIMESTAMP(3) NOT NULL,
    "finalizadaEn" TIMESTAMP(3),
    "estado" "EstadoSessionLog" NOT NULL DEFAULT 'EN_PROGRESO',
    "duracionActivaSeg" INTEGER,
    "energia1a5" INTEGER,
    "suenoHorasPrevias" DOUBLE PRECISION,
    "pesoCorporalKg" DOUBLE PRECISION,
    "notas" TEXT,
    "sincronizadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "sessionLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "numeroSerie" INTEGER NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "rir" INTEGER,
    "tipo" "TipoSet" NOT NULL DEFAULT 'TRABAJO',
    "completadaEn" TIMESTAMP(3) NOT NULL,
    "descansoRealSeg" INTEGER,
    "notas" TEXT,
    "molestiaFlag" BOOLEAN NOT NULL DEFAULT false,
    "molestiaZona" TEXT,
    "molestiaNivel1a10" INTEGER,
    "esPr" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "tipo" "TipoPR" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "pesoKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "setLogId" TEXT,
    "logradoEn" TIMESTAMP(3) NOT NULL,
    "prAnteriorValor" DOUBLE PRECISION,
    "estimacionBajaConfianza" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "pesoKg" DOUBLE PRECISION,
    "grasaPct" DOUBLE PRECISION,
    "grasaVisceral" DOUBLE PRECISION,
    "masaMuscularKg" DOUBLE PRECISION,
    "cinturaCm" DOUBLE PRECISION,
    "pechoCm" DOUBLE PRECISION,
    "brazoDCm" DOUBLE PRECISION,
    "musloDCm" DOUBLE PRECISION,
    "cuelloCm" DOUBLE PRECISION,
    "caderaCm" DOUBLE PRECISION,
    "fuente" "FuenteMetric" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Exercise_nombre_idx" ON "Exercise"("nombre");

-- CreateIndex
CREATE INDEX "Block_atletaId_estado_idx" ON "Block"("atletaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplate_blockId_clave_key" ON "SessionTemplate"("blockId", "clave");

-- CreateIndex
CREATE INDEX "TemplateExercise_sessionTemplateId_idx" ON "TemplateExercise"("sessionTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekOverride_blockId_numeroSemana_key" ON "WeekOverride"("blockId", "numeroSemana");

-- CreateIndex
CREATE INDEX "ScheduledSession_atletaId_fechaProgramada_idx" ON "ScheduledSession"("atletaId", "fechaProgramada");

-- CreateIndex
CREATE INDEX "SessionLog_atletaId_estado_idx" ON "SessionLog"("atletaId", "estado");

-- CreateIndex
CREATE INDEX "SetLog_sessionLogId_idx" ON "SetLog"("sessionLogId");

-- CreateIndex
CREATE INDEX "SetLog_exerciseId_completadaEn_idx" ON "SetLog"("exerciseId", "completadaEn");

-- CreateIndex
CREATE INDEX "PersonalRecord_atletaId_exerciseId_tipo_idx" ON "PersonalRecord"("atletaId", "exerciseId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMetric_atletaId_fecha_key" ON "BodyMetric"("atletaId", "fecha");

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekOverride" ADD CONSTRAINT "WeekOverride_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "SessionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "ScheduledSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_sessionLogId_fkey" FOREIGN KEY ("sessionLogId") REFERENCES "SessionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

