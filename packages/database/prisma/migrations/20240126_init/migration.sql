-- CreateEnum
CREATE TYPE "carecompanion"."UserRole" AS ENUM ('admin', 'care_coordinator', 'family_member', 'view_only');

-- CreateEnum
CREATE TYPE "carecompanion"."PrivacyLevel" AS ENUM ('private', 'family');

-- CreateEnum
CREATE TYPE "carecompanion"."MedicationStatus" AS ENUM ('given', 'missed', 'refused', 'scheduled');

-- CreateEnum
CREATE TYPE "carecompanion"."DocumentType" AS ENUM ('medical_record', 'financial', 'legal', 'insurance', 'other');

-- CreateEnum
CREATE TYPE "carecompanion"."ParsingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "carecompanion"."InsightSeverity" AS ENUM ('info', 'warning', 'alert');

-- CreateTable
CREATE TABLE "carecompanion"."families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."users" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "carecompanion"."UserRole" NOT NULL,
    "auth_provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."patients" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_of_birth" DATE,
    "primary_caregiver_id" TEXT,
    "medical_record_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."journal_entries" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_vector" DOUBLE PRECISION[],
    "voice_transcript" TEXT,
    "voice_audio_url" TEXT,
    "privacy_level" "carecompanion"."PrivacyLevel" NOT NULL DEFAULT 'family',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."journal_tags" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "journal_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."medications" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "prescriber" TEXT,
    "pharmacy" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "refills_remaining" INTEGER,
    "photo_url" TEXT,
    "instructions" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."medication_logs" (
    "id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "given_time" TIMESTAMP(3),
    "given_by_user_id" TEXT,
    "status" "carecompanion"."MedicationStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."care_tasks" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "recurrence_rule" TEXT,
    "assigned_to_user_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."care_task_logs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "completed_by_user_id" TEXT NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "care_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."documents" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "type" "carecompanion"."DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "original_filename" TEXT,
    "s3_key" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "parsed_content" JSONB,
    "parsing_status" "carecompanion"."ParsingStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."item_locations" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "location_description" TEXT NOT NULL,
    "photo_url" TEXT,
    "category" TEXT,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."insights" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "carecompanion"."InsightSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "acknowledged_by_user_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carecompanion"."audit_logs" (
    "id" TEXT NOT NULL,
    "family_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carecompanion"."users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "carecompanion"."users_auth_provider_id_key" ON "users"("auth_provider_id");

-- CreateIndex
CREATE INDEX "carecompanion"."users_family_id_idx" ON "users"("family_id");

-- CreateIndex
CREATE INDEX "carecompanion"."users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "carecompanion"."patients_family_id_idx" ON "patients"("family_id");

-- CreateIndex
CREATE INDEX "carecompanion"."journal_entries_family_id_patient_id_idx" ON "journal_entries"("family_id", "patient_id");

-- CreateIndex
CREATE INDEX "carecompanion"."journal_entries_created_at_idx" ON "journal_entries"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "carecompanion"."journal_tags_journal_entry_id_tag_key" ON "journal_tags"("journal_entry_id", "tag");

-- CreateIndex
CREATE INDEX "carecompanion"."medications_patient_id_idx" ON "medications"("patient_id");

-- CreateIndex
CREATE INDEX "carecompanion"."medications_patient_id_end_date_idx" ON "medications"("patient_id", "end_date");

-- CreateIndex
CREATE INDEX "carecompanion"."medication_logs_medication_id_idx" ON "medication_logs"("medication_id");

-- CreateIndex
CREATE INDEX "carecompanion"."medication_logs_scheduled_time_idx" ON "medication_logs"("scheduled_time");

-- CreateIndex
CREATE INDEX "carecompanion"."medication_logs_status_idx" ON "medication_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carecompanion"."medication_logs_medication_id_scheduled_time_key" ON "medication_logs"("medication_id", "scheduled_time");

-- CreateIndex
CREATE INDEX "carecompanion"."care_tasks_family_id_idx" ON "care_tasks"("family_id");

-- CreateIndex
CREATE INDEX "carecompanion"."care_tasks_assigned_to_user_id_idx" ON "care_tasks"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "carecompanion"."care_task_logs_task_id_scheduled_date_idx" ON "care_task_logs"("task_id", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "carecompanion"."care_task_logs_task_id_scheduled_date_key" ON "care_task_logs"("task_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "carecompanion"."documents_family_id_patient_id_idx" ON "documents"("family_id", "patient_id");

-- CreateIndex
CREATE INDEX "carecompanion"."documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "carecompanion"."item_locations_family_id_idx" ON "item_locations"("family_id");

-- CreateIndex
CREATE INDEX "carecompanion"."item_locations_item_name_idx" ON "item_locations"("item_name");

-- CreateIndex
CREATE INDEX "carecompanion"."insights_family_id_patient_id_idx" ON "insights"("family_id", "patient_id");

-- CreateIndex
CREATE INDEX "carecompanion"."insights_severity_acknowledged_at_idx" ON "insights"("severity", "acknowledged_at");

-- CreateIndex
CREATE INDEX "carecompanion"."audit_logs_family_id_idx" ON "audit_logs"("family_id");

-- CreateIndex
CREATE INDEX "carecompanion"."audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "carecompanion"."audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "carecompanion"."users" ADD CONSTRAINT "users_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."patients" ADD CONSTRAINT "patients_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."patients" ADD CONSTRAINT "patients_primary_caregiver_id_fkey" FOREIGN KEY ("primary_caregiver_id") REFERENCES "carecompanion"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."journal_entries" ADD CONSTRAINT "journal_entries_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."journal_entries" ADD CONSTRAINT "journal_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."journal_entries" ADD CONSTRAINT "journal_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."journal_tags" ADD CONSTRAINT "journal_tags_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "carecompanion"."journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."medications" ADD CONSTRAINT "medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."medications" ADD CONSTRAINT "medications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."medication_logs" ADD CONSTRAINT "medication_logs_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "carecompanion"."medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."medication_logs" ADD CONSTRAINT "medication_logs_given_by_user_id_fkey" FOREIGN KEY ("given_by_user_id") REFERENCES "carecompanion"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_tasks" ADD CONSTRAINT "care_tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_tasks" ADD CONSTRAINT "care_tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_tasks" ADD CONSTRAINT "care_tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "carecompanion"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_tasks" ADD CONSTRAINT "care_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_task_logs" ADD CONSTRAINT "care_task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "carecompanion"."care_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."care_task_logs" ADD CONSTRAINT "care_task_logs_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."documents" ADD CONSTRAINT "documents_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."documents" ADD CONSTRAINT "documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."item_locations" ADD CONSTRAINT "item_locations_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."item_locations" ADD CONSTRAINT "item_locations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."item_locations" ADD CONSTRAINT "item_locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "carecompanion"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."insights" ADD CONSTRAINT "insights_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."insights" ADD CONSTRAINT "insights_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "carecompanion"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."insights" ADD CONSTRAINT "insights_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "carecompanion"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."audit_logs" ADD CONSTRAINT "audit_logs_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "carecompanion"."families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carecompanion"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "carecompanion"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

