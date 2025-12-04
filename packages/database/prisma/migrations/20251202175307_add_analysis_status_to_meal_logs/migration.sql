-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('none', 'pending', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "meal_logs" ADD COLUMN "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'none';
