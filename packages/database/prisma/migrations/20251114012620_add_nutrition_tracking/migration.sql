/*
  Warnings:

  - A unique constraint covering the columns `[linked_patient_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FactDomain" AS ENUM ('medical', 'financial', 'estate', 'wellbeing');

-- CreateEnum
CREATE TYPE "FactStatus" AS ENUM ('proposed', 'active', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "FactAssertedBy" AS ENUM ('ai', 'user', 'system');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('caregiver', 'patient');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('caregiver', 'patient');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('physician', 'specialist', 'therapist', 'pharmacist', 'facility', 'other');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('medication', 'exercise', 'diet', 'therapy', 'lifestyle', 'monitoring', 'followup', 'tests');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('urgent', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'other');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('google', 'apple');

-- CreateEnum
CREATE TYPE "SyncEventType" AS ENUM ('medication', 'care_task', 'appointment');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "impersonated_by" TEXT;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "invitation_type" "InvitationType" NOT NULL DEFAULT 'caregiver',
ADD COLUMN     "patient_id" TEXT;

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "auto_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "provider_id" TEXT,
ADD COLUMN     "source_document_id" TEXT,
ADD COLUMN     "visit_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "medication_logs" ADD COLUMN     "completed_by_id" TEXT;

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "prescribing_provider_id" TEXT;

-- AlterTable
ALTER TABLE "patient_checklist_logs" ADD COLUMN     "completed_by_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "linked_patient_id" TEXT,
ADD COLUMN     "user_type" "UserType" NOT NULL DEFAULT 'caregiver';

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "type" "ProviderType" NOT NULL DEFAULT 'physician',
    "phone" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "facility" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "document_id" TEXT,
    "visit_date" TIMESTAMP(3),
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'medium',
    "frequency" TEXT,
    "duration" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "RecommendationStatus" NOT NULL DEFAULT 'pending',
    "implemented_at" TIMESTAMP(3),
    "linked_medication_id" TEXT,
    "linked_care_task_id" TEXT,
    "linked_checklist_item_id" TEXT,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "dismissed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_entities" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "display_name" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facts" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "domain" "FactDomain" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "status" "FactStatus" NOT NULL DEFAULT 'proposed',
    "asserted_by" "FactAssertedBy" NOT NULL DEFAULT 'ai',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "effective_start" TIMESTAMP(3),
    "effective_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sources" (
    "id" TEXT NOT NULL,
    "fact_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "section" TEXT,
    "span_hash" TEXT,
    "weight" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_recommendations" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "daily_calories" INTEGER,
    "protein_grams" DOUBLE PRECISION,
    "carbs_grams" DOUBLE PRECISION,
    "fat_grams" DOUBLE PRECISION,
    "sodium_mg" DOUBLE PRECISION,
    "restrictions" TEXT[],
    "goals" TEXT[],
    "special_instructions" TEXT,
    "recommended_meal_times" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "photo_urls" TEXT[],
    "voice_note_url" TEXT,
    "nutrition_data" JSONB,
    "meets_guidelines" BOOLEAN,
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "journal_entry_id" TEXT,
    "template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_templates" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "nutrition_data" JSONB NOT NULL,
    "photo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "family_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "calendar_id" TEXT NOT NULL,
    "calendar_name" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_event_types" "SyncEventType"[],
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_sync_logs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "event_type" "SyncEventType" NOT NULL,
    "internal_event_id" TEXT NOT NULL,
    "external_event_id" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "providers_family_id_is_active_idx" ON "providers"("family_id", "is_active");

-- CreateIndex
CREATE INDEX "recommendations_family_id_status_idx" ON "recommendations"("family_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_patient_id_idx" ON "recommendations"("patient_id");

-- CreateIndex
CREATE INDEX "recommendations_document_id_idx" ON "recommendations"("document_id");

-- CreateIndex
CREATE INDEX "fact_entities_family_id_type_idx" ON "fact_entities"("family_id", "type");

-- CreateIndex
CREATE INDEX "facts_family_id_domain_status_idx" ON "facts"("family_id", "domain", "status");

-- CreateIndex
CREATE INDEX "facts_entity_id_key_status_idx" ON "facts"("entity_id", "key", "status");

-- CreateIndex
CREATE INDEX "fact_sources_fact_id_idx" ON "fact_sources"("fact_id");

-- CreateIndex
CREATE INDEX "fact_sources_source_type_source_id_idx" ON "fact_sources"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_recommendations_recommendation_id_key" ON "nutrition_recommendations"("recommendation_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_logs_journal_entry_id_key" ON "meal_logs"("journal_entry_id");

-- CreateIndex
CREATE INDEX "meal_logs_patient_id_consumed_at_idx" ON "meal_logs"("patient_id", "consumed_at" DESC);

-- CreateIndex
CREATE INDEX "meal_logs_user_id_idx" ON "meal_logs"("user_id");

-- CreateIndex
CREATE INDEX "meal_templates_patient_id_is_active_idx" ON "meal_templates"("patient_id", "is_active");

-- CreateIndex
CREATE INDEX "calendar_connections_user_id_sync_enabled_idx" ON "calendar_connections"("user_id", "sync_enabled");

-- CreateIndex
CREATE INDEX "calendar_connections_family_id_sync_enabled_idx" ON "calendar_connections"("family_id", "sync_enabled");

-- CreateIndex
CREATE INDEX "calendar_sync_logs_connection_id_synced_at_idx" ON "calendar_sync_logs"("connection_id", "synced_at" DESC);

-- CreateIndex
CREATE INDEX "calendar_sync_logs_internal_event_id_idx" ON "calendar_sync_logs"("internal_event_id");

-- CreateIndex
CREATE INDEX "calendar_sync_logs_external_event_id_idx" ON "calendar_sync_logs"("external_event_id");

-- CreateIndex
CREATE INDEX "invitations_patient_id_idx" ON "invitations"("patient_id");

-- CreateIndex
CREATE INDEX "journal_entries_source_document_id_idx" ON "journal_entries"("source_document_id");

-- CreateIndex
CREATE INDEX "medications_prescribing_provider_id_idx" ON "medications"("prescribing_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_linked_patient_id_key" ON "users"("linked_patient_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_linked_patient_id_fkey" FOREIGN KEY ("linked_patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_linked_medication_id_fkey" FOREIGN KEY ("linked_medication_id") REFERENCES "medications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_linked_care_task_id_fkey" FOREIGN KEY ("linked_care_task_id") REFERENCES "care_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_linked_checklist_item_id_fkey" FOREIGN KEY ("linked_checklist_item_id") REFERENCES "patient_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_prescribing_provider_id_fkey" FOREIGN KEY ("prescribing_provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonated_by_fkey" FOREIGN KEY ("impersonated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_checklist_logs" ADD CONSTRAINT "patient_checklist_logs_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_entities" ADD CONSTRAINT "fact_entities_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "fact_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sources" ADD CONSTRAINT "fact_sources_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_recommendations" ADD CONSTRAINT "nutrition_recommendations_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "meal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_sync_logs" ADD CONSTRAINT "calendar_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
