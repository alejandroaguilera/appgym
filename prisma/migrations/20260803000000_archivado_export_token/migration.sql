-- AlterTable
ALTER TABLE "SessionLog" ADD COLUMN "archivadaEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "exportToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_exportToken_key" ON "User"("exportToken");
