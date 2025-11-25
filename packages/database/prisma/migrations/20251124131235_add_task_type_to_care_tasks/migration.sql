-- CreateEnum
CREATE TYPE "CareTaskType" AS ENUM ('task', 'appointment');

-- AlterTable: Add task_type column with default
ALTER TABLE "care_tasks" ADD COLUMN "task_type" "CareTaskType" NOT NULL DEFAULT 'task';

-- Data Migration: Classify existing appointments based on emoji markers
-- These are tasks that were created with appointment emojis in the description
UPDATE "care_tasks"
SET "task_type" = 'appointment'
WHERE
  description LIKE '%🏥%' OR
  description LIKE '%🧠%' OR
  description LIKE '%🔬%' OR
  description LIKE '%👥%' OR
  description LIKE '%👨‍👩‍👧‍👦%';

-- Data Migration: Remove emoji prefixes from descriptions
-- Only removes emojis at the start of descriptions (not embedded ones)
UPDATE "care_tasks"
SET description = REGEXP_REPLACE(description, '^(🏥|🧠|🔬|👥|👨‍👩‍👧‍👦)\s*', '', 'g')
WHERE description ~ '^(🏥|🧠|🔬|👥|👨‍👩‍👧‍👦)';
