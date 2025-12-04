-- AlterTable: Rename notes column to description in meal_logs
ALTER TABLE "meal_logs" RENAME COLUMN "notes" TO "description";
