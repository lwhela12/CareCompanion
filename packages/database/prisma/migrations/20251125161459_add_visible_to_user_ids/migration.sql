-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "visible_to_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
