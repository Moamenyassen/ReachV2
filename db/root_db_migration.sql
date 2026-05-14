-- =================================================================
-- REACH V1: NORMALIZED DATABASE ARCHITECTURE MIGRATION SCRIPT
-- =================================================================
-- This script creates the new high-performance table structure.
-- Run this in your Supabase SQL Editor.
-- 1. COMPANIES (Base Tenant Table)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. BRANCHES (Regional Structure)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    company_id TEXT REFERENCES companies(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code) -- Prevent duplicate branch codes per company
);
-- 3. ROUTES (Sales Routes)
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    branch_id UUID REFERENCES branches(id),
    company_id TEXT REFERENCES companies(id),
    rep_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, branch_id, name) -- Unique route name per branch
);
-- 4. NORMALIZED CUSTOMERS (The New Master Table)
CREATE TABLE IF NOT EXISTS normalized_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    -- Identification
    client_code TEXT NOT NULL,
    -- Internal ERP Code
    reach_customer_code TEXT,
    -- Reach Global ID (Optional/Generated)
    -- basic Info
    name_en TEXT NOT NULL,
    name_ar TEXT,
    phone TEXT,
    address TEXT,
    -- Location (Critical for Reach)
    lat DOUBLE PRECISION DEFAULT 0,
    lng DOUBLE PRECISION DEFAULT 0,
    -- Segmentation
    classification TEXT,
    vat TEXT,
    buyer_id TEXT,
    store_type TEXT,
    district TEXT,
    -- Metadata
    dynamic_data JSONB DEFAULT '{}'::jsonb,
    -- For extra CSV columns
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    UNIQUE(company_id, branch_id, client_code) -- Correct uniqueness scope
);
-- 5. ROUTE VISITS (The Schedule - Decoupled from Customer Details)
CREATE TABLE IF NOT EXISTS route_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT REFERENCES companies(id),
    route_id UUID REFERENCES routes(id),
    customer_id UUID REFERENCES normalized_customers(id),
    -- Schedule
    week_number TEXT NOT NULL,
    -- e.g., 'W1', 'W2'
    day_name TEXT NOT NULL,
    -- e.g., 'Sunday'
    visit_order INTEGER DEFAULT 0,
    visit_type TEXT DEFAULT 'SCHEDULED',
    -- 'SCHEDULED', 'ADHOC'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(route_id, customer_id, week_number, day_name) -- Prevent duplicate visits
);
-- 6. ROUTE VERSIONS (Upload History & Rollback Support)
CREATE TABLE IF NOT EXISTS route_versions (
    id TEXT PRIMARY KEY,
    -- Using Timestamp/UUID string from App
    company_id TEXT REFERENCES companies(id),
    status TEXT DEFAULT 'pending',
    -- 'uploading', 'completed', 'failed'
    record_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- =================================================================
-- PERFORMANCE INDEXES (Make it fast!)
-- =================================================================
-- Fast Customer Lookups
CREATE INDEX IF NOT EXISTS idx_norm_customers_lookup ON normalized_customers(company_id, client_code);
-- Fast Search (Name & Code)
CREATE INDEX IF NOT EXISTS idx_norm_customers_search ON normalized_customers USING GIN (
    to_tsvector('english', name_en || ' ' || client_code)
);
-- Geospatial Index (For Maps) - Requires PostGIS extension enabled
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE INDEX IF NOT EXISTS idx_norm_customers_geo 
-- ON normalized_customers USING GIST (ll_to_earth(lat, lng));
-- Fast Schedule Querying
CREATE INDEX IF NOT EXISTS idx_route_visits_schedule ON route_visits(route_id, week_number, day_name);
-- =================================================================
-- CLEANUP (DANGER ZONE - RUN ONLY AFTER VERIFICATION)
-- =================================================================
-- DROP TABLE IF EXISTS customers CASCADE;      -- Replaced by authorized_customers
-- DROP TABLE IF EXISTS route_data CASCADE;     -- Validated obsoslete
-- DROP TABLE IF EXISTS temp_uploads CASCADE;