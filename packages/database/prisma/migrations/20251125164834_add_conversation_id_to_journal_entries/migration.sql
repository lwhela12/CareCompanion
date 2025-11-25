-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "conversation_id" TEXT;
