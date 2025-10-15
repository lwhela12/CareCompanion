-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('meals', 'medication', 'exercise', 'hygiene', 'social', 'therapy', 'other');

-- CreateTable
CREATE TABLE "patient_checklist_items" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ChecklistCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_checklist_logs" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "voice_note_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_checklist_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_checklist_items_patient_id_is_active_idx" ON "patient_checklist_items"("patient_id", "is_active");

-- CreateIndex
CREATE INDEX "patient_checklist_logs_item_id_completed_at_idx" ON "patient_checklist_logs"("item_id", "completed_at" DESC);

-- AddForeignKey
ALTER TABLE "patient_checklist_items" ADD CONSTRAINT "patient_checklist_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_checklist_items" ADD CONSTRAINT "patient_checklist_items_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_checklist_logs" ADD CONSTRAINT "patient_checklist_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "patient_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
