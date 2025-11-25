-- AlterTable
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "logged_to_journal_at" TIMESTAMP(3);
