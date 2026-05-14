-- ============================================================
-- Excel Workflows — Smart Workflows (AI-translated mini-ETL)
-- ============================================================
-- Each workflow = one saved task created from a natural-language
-- prompt + sample input files. The structured workflow_json is
-- deterministic Python at run-time; AI translation only happens
-- once at setup. Daily executions never re-call the LLM.
-- ============================================================

CREATE TABLE IF NOT EXISTS excel_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_shared BOOLEAN DEFAULT FALSE,

  -- The user's original natural-language prompt — kept for transparency / re-translation.
  prompt TEXT NOT NULL,

  -- The validated workflow JSON. Shape:
  -- {
  --   "inputs":  [{ "slot": "prices",   "filename": "...", "sheet": "Sheet1" }, ...],
  --   "steps":   [
  --     { "op": "join",     "left": "prices", "right": "master", "on_left": "Item_Code", "on_right": "Code", "how": "left", "as": "with_names" },
  --     { "op": "fill",     "input": "with_names", "column": "Van_Stock", "value": 0 },
  --     { "op": "rename",   "input": "...", "map": { "Old": "New" } },
  --     { "op": "select",   "input": "...", "columns": ["A", "B"] },
  --   ],
  --   "output":  {
  --     "final_step":     "<as-name-of-last-step>",
  --     "columns":        ["Item Code", "Name", "New Price", "Van Stock"],
  --     "filename":       "result.xlsx",
  --     "sheet":          "Result",
  --     "output_type":    "records",       -- "records" | "value" | "template"  (defaults to "records")
  --     "agg_func":       "sum",           -- only when output_type = "value":  sum | count | avg | min | max
  --     "agg_column":     "New Price",     -- only when output_type = "value"
  --     "template_title": "Weekly Report"  -- only when output_type = "template"
  --   }
  -- }
  -- NOTE: schema is JSONB so adding optional output_type/agg_*/template_title fields requires NO migration.
  -- Rows saved before these fields existed are treated as "records" by the backend.
  workflow_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Per-input-slot schema fingerprint captured at setup time.
  -- Used on daily run to detect renamed columns and propose a re-map.
  -- Shape: { slotName: { filename, sheet, columns: [{ name, dtype, sample: [...] }] } }
  input_schemas JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_excel_workflows_user     ON excel_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_excel_workflows_company  ON excel_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_excel_workflows_updated  ON excel_workflows(updated_at DESC);

-- ============================================================
-- updated_at auto-touch
-- ============================================================
CREATE OR REPLACE FUNCTION touch_excel_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_excel_workflows_touch ON excel_workflows;
CREATE TRIGGER trg_excel_workflows_touch
  BEFORE UPDATE ON excel_workflows
  FOR EACH ROW EXECUTE FUNCTION touch_excel_workflows_updated_at();

-- ============================================================
-- RLS — anon-access pattern (matches existing convention).
-- App layer enforces user_id + company_id.
-- ============================================================
ALTER TABLE excel_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "excel_workflows_anon_access" ON excel_workflows;
CREATE POLICY "excel_workflows_anon_access" ON excel_workflows
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON excel_workflows TO anon, authenticated, service_role;

-- ============================================================
-- Done. Run via Supabase SQL Editor.
-- ============================================================
