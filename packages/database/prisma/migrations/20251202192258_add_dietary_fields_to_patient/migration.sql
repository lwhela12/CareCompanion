-- AlterTable
ALTER TABLE "patients" ADD COLUMN "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "patients" ADD COLUMN "dietary_restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[];
