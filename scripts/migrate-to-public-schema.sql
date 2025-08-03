-- Migration script to move all tables from carecompanion schema to public schema
-- This script safely moves all objects while preserving data and relationships

BEGIN;

-- 1. First, grant necessary permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;

-- 2. Move all tables from carecompanion to public schema
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'carecompanion'
    LOOP
        EXECUTE format('ALTER TABLE carecompanion.%I SET SCHEMA public', tbl.tablename);
        RAISE NOTICE 'Moved table % to public schema', tbl.tablename;
    END LOOP;
END $$;

-- 3. Move all sequences
DO $$
DECLARE
    seq RECORD;
BEGIN
    FOR seq IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'carecompanion'
    LOOP
        EXECUTE format('ALTER SEQUENCE carecompanion.%I SET SCHEMA public', seq.sequence_name);
        RAISE NOTICE 'Moved sequence % to public schema', seq.sequence_name;
    END LOOP;
END $$;

-- 4. Move all types (enums)
DO $$
DECLARE
    typ RECORD;
BEGIN
    FOR typ IN 
        SELECT typname 
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'carecompanion' 
        AND t.typtype = 'e'
    LOOP
        EXECUTE format('ALTER TYPE carecompanion.%I SET SCHEMA public', typ.typname);
        RAISE NOTICE 'Moved type % to public schema', typ.typname;
    END LOOP;
END $$;

-- 5. Update search_path for the database to default
ALTER DATABASE carecompanion SET search_path TO public;

-- 6. Drop the now-empty carecompanion schema
DROP SCHEMA IF EXISTS carecompanion;

COMMIT;

-- Verify the migration
SELECT 
    schemaname,
    COUNT(*) as table_count 
FROM pg_tables 
WHERE schemaname IN ('public', 'carecompanion') 
GROUP BY schemaname;