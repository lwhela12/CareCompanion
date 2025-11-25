-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
