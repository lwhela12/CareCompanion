-- AlterTable
ALTER TABLE "care_tasks" ADD COLUMN     "is_recurrence_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_task_id" TEXT,
ADD COLUMN     "recurrence_end_date" TIMESTAMP(3),
ADD COLUMN     "recurrence_rule" TEXT;

-- CreateIndex
CREATE INDEX "care_tasks_parent_task_id_idx" ON "care_tasks"("parent_task_id");

-- AddForeignKey
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "care_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
