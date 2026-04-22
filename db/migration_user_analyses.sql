-- Migration: Create user_analyses table for AI Data Analysis module
CREATE TABLE IF NOT EXISTS public.user_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id TEXT, -- Matching the project's pattern of using TEXT for company IDs
    file_name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Stores headers, row count, and first 5 rows
    last_results JSONB DEFAULT '{}'::jsonb, -- Stores the AI generated KPIs, insights, and chart data
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_analyses ENABLE ROW LEVEL SECURITY;

-- Set up RLS Policies
-- Note: Using auth.uid() check for security. 
-- In some parts of this app, company-based RLS is also used.
CREATE POLICY "Users can manage their own analyses" 
ON public.user_analyses 
FOR ALL 
USING (auth.uid() = user_id);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE user_analyses;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_analyses_updated_at
    BEFORE UPDATE ON public.user_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
