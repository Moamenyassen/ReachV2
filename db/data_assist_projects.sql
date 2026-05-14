-- ============================================================
-- Data Assist Projects — saved AI-driven data analyses
-- ============================================================
-- Each project = one analyzed dataset (uploaded file or pull from
-- Reach tables). Stores the schema, raw sample, computed stats,
-- and Gemini-generated insights so the user can re-open later.
-- ============================================================

CREATE TABLE IF NOT EXISTS data_assist_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  source_type TEXT NOT NULL DEFAULT 'upload',  -- 'upload' | 'reach_table'
  source_meta JSONB DEFAULT '{}'::jsonb,        -- { filename, size, table_name, row_count }
  dataset_type TEXT,                             -- AI guess: 'sales' | 'inventory' | 'customers' | etc.
  schema JSONB DEFAULT '[]'::jsonb,              -- [{ name, role, semantic, dtype, sample }]
  preview_rows JSONB DEFAULT '[]'::jsonb,        -- first 20 rows for re-display
  insights JSONB DEFAULT '[]'::jsonb,            -- [{ id, title, narrative, chart_spec, kpi }]
  kpis JSONB DEFAULT '{}'::jsonb,                -- baseline KPIs: rows, distinct, date_range
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_assist_projects_user      ON data_assist_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_data_assist_projects_company   ON data_assist_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_data_assist_projects_category  ON data_assist_projects(category);
CREATE INDEX IF NOT EXISTS idx_data_assist_projects_updated   ON data_assist_projects(updated_at DESC);

-- ============================================================
-- updated_at auto-touch
-- ============================================================
CREATE OR REPLACE FUNCTION touch_data_assist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_data_assist_touch ON data_assist_projects;
CREATE TRIGGER trg_data_assist_touch
  BEFORE UPDATE ON data_assist_projects
  FOR EACH ROW EXECUTE FUNCTION touch_data_assist_updated_at();

-- ============================================================
-- RLS policies
-- ============================================================
ALTER TABLE data_assist_projects ENABLE ROW LEVEL SECURITY;

-- Anon-key access pattern (matches root_rls_policies.sql convention).
-- Application-layer enforces user_id + company_id; client uses anon key.
DROP POLICY IF EXISTS "data_assist_anon_access" ON data_assist_projects;
CREATE POLICY "data_assist_anon_access" ON data_assist_projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON data_assist_projects TO anon, authenticated, service_role;

-- ============================================================
-- Done. Run via Supabase SQL Editor.
-- ============================================================
