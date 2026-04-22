
export interface Customer {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: string;
  clientCode?: string;
  routeName?: string;
  address?: string;
  week?: string;
  regionDescription?: string;
  regionCode?: string;
  nameAr?: string;
  addedBy?: string;
  addedDate?: string;
  rowId?: string; // Database UUID for updates
  is_visited?: boolean; // For Route Execution Status

  // Extended Fields
  branch?: string;
  phone?: string;
  district?: string;
  vat?: string;
  buyerId?: string; // buyer_identification_no
  classification?: string;
  storeType?: string;
  userCode?: string; // Sales Rep / User ID
  reachCustomerCode?: string; // Auto-generated Global Reach ID
  visitOrder?: number;
  data?: Record<string, any>; // Dynamic/Extra Data
}

// ==========================================
// NORMALIZED ARCHITECTURE INTERFACES
// ==========================================

export interface NormalizedBranch {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  company_id: string;
  is_active: boolean;
  lat?: number;
  lng?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizedRep {
  id: string;
  user_code: string;
  name: string;
  branch_id: string;
  company_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizedRoute {
  id: string;
  name: string;
  rep_code?: string;
  rep_id?: string; // Foreign Key to NormalizedRep
  branch_id: string;
  company_id: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  branch_name?: string;
  branch_code?: string;
}

export interface NormalizedCustomer {
  id: string;
  client_code: string;
  name_en: string;
  name_ar?: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  classification?: string;
  branch_id: string;
  company_id: string;
  vat?: string;
  buyer_id?: string;
  store_type?: string;
  district?: string;
  dynamic_data?: Record<string, any>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  branch_name?: string;
  branch_code?: string;
}

export interface RouteVisit {
  id: string;
  route_id: string;
  customer_id: string;
  week_number?: string;
  day_name?: string;
  visit_order?: number;
  company_id: string;
  visit_type?: string;
  estimated_duration_min?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  route_name?: string;
  customer_name?: string;
  customer_lat?: number;
  customer_lng?: number;
}

// CSV Input Row (before normalization)
export interface CSVRowInput {
  branch_code: string;
  branch_name: string;
  route_name: string;
  rep_code?: string;
  client_code: string;
  customer_name_en: string;
  customer_name_ar?: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  classification?: string;
  week_number?: string;
  day_name?: string;
  visit_order?: number;
  [key: string]: any; // Allow additional dynamic fields
}

// ETL Processing Result
export interface ETLResult {
  success: boolean;
  stats: {
    branches: { added: number; updated: number; total: number };
    reps: { added: number; updated: number; total: number };
    routes: { added: number; updated: number; total: number };
    customers: { added: number; updated: number; total: number };
    visits: { added: number; skipped: number; total: number };
  };
  error?: string;
}

// ETL Progress Callback
export interface ETLProgress {
  step: number;
  stepName: string;
  percent: number;
  currentCount?: number;
  totalCount?: number;
}

export interface RouteSegment {
  fromId: string;
  toId: string;
  distanceKm: number;
  estimatedTimeMin: number;
}

export interface RouteSummary {
  totalDistanceKm: number;
  totalTimeMin: number;
  stopCount: number;
  segments: RouteSegment[];
}



export interface AISuggestion {
  id: string;
  type: 'MOVE_ROUTE' | 'OPTIMIZE_SEQUENCE';
  customer: Customer;
  currentRoute: string;
  targetRoute: string;
  reason: string;
  saving: string;
  currentCentroid: { lat: number, lng: number };
  targetCentroid: { lat: number, lng: number };
  distToCurrent: number;
  distToTarget: number;
  suggestedDay?: string;
  nearbyTargetNeighbors: {
    lat: number;
    lng: number;
    name: string;
    day: string;
    clientCode?: string;
    routeName?: string;
  }[];
}

export interface AIReport {
  summary: string;
  risks: string[];
  recommendations: string[];
  summary_ar: string;
  risks_ar: string[];
  recommendations_ar: string[];
}

export interface DayAnalysis {
  day: string;
  current_eff: number;
  projected_eff: number;
  stops: number;
  dist: number;
  time: number;
  instruction: string;
  instruction_ar: string;
  impact_note: string;
  impact_note_ar: string;
}

export interface EfficiencyAnalysis {
  score_rating: 'Critical' | 'Sub-optimal' | 'Healthy' | 'Elite';
  coach_intro: string;
  coach_intro_ar: string;
  diagnostic_why: string;
  diagnostic_why_ar: string;
  growth_steps: string[];
  growth_steps_ar: string[];
  weekly_summary: {
    current: { portfolio_size: number; dist: number; eff: number };
    projected: { portfolio_size: number; dist: number; eff: number };
  };
  day_by_day: DayAnalysis[];
}

export interface Branch {
  code: string;
  name: string;
  lat: number;
  lng: number;
  day?: string;
  clientCode?: string;
  routeName?: string;
}



export interface RouteBreakdown {
  name: string;
  skipped: number;
}

export interface RegionStats {
  name: string;
  count: number;
  skipped: number;
  routes?: RouteBreakdown[];
}

export interface SkippedRecord {
  name: string;
  clientCode?: string;
  reason: string;
  region?: string;
  route?: string;
}

export interface HistoryStats {
  distinctClients?: number;
  skippedRecords?: number;
  distinctSkipped?: number;
  regions?: string[];
  regionBreakdown?: RegionStats[];
  skippedDetails?: SkippedRecord[];

  // Normalized
  normalized?: boolean;
  branches?: { added: number; updated: number; total: number };
  routes?: { added: number; updated: number; total: number };
  customers?: { added: number; updated: number; total: number };
  visits?: { added: number; skipped: number; total: number };
}

export interface Company {
  id: string;
  name: string;
  subscriptionTier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  maxUsers: number;
  maxRoutes?: number;
  maxCustomers?: number;
  maxScannerCap?: number;
  isActive: boolean;
  createdAt: string;
  features: string[];
  adminUsername?: string;
  expirationDate?: string | null;
  lastUploadDate?: string | null;
  lastUploadRecordCount?: number | null;
  settings?: CompanySettings;
  logoUrl?: string;
  // New Onboarding Fields
  createdByUserId?: string;
  subscriptionStatus?: 'ACTIVE' | 'PENDING' | 'TRIAL' | 'EXPIRED';
  planId?: string;
}

export interface CompanySettings {
  common: {
    general: {
      currency: string;
      distanceUnit: 'km' | 'mi';
      language: 'en' | 'ar';
      dataRetentionDays: number;
      country?: string;
      allowedBranches?: string[]; // Deprecated in favor of branches below
      branches?: BranchConfig[];
    };
    theme: {
      enableDarkMode: boolean;
      uiMode?: 'classic' | 'modern';
    };
  };
  modules: {
    insights: {
      enabled: boolean;
      minClientsPerRoute: number;
      maxClientsPerRoute: number;
      efficiencyThreshold: number;
      visitFrequencyDays: number;
      workingDaysPerWeek: number;
      churnThresholdDays: number;
      nearbyRadiusMeters: number;
    };
    market: {
      enabled: boolean;
      searchTimeoutSeconds: number;
      minZoomLevel: number;
      enableDeepScan: boolean;
      defaultKeywords: string;
      exportFormat: 'csv' | 'json';
      maxLeadsPerScan: number;
    };
    optimizer: {
      enabled: boolean;
      avgSpeedKmh: number;
      serviceTimeMin: number;
      trafficFactor: number;
      maxWorkingHours: number;
      fuelCostPerKm: number;
      driverHourlyRate: number;
      startLocation: 'DEPOT' | 'HOME';
      maxDistancePerRouteKm: number;
      breakTimeMin: number;
      costObjective: 'DISTANCE' | 'TIME' | 'BALANCED';
      drivingDistanceFactor?: number;
    };
    map: {
      enabled: boolean;
      defaultCenter: [number, number];
      defaultZoom: number;
      showTraffic: boolean;
      clusterMarkers: boolean;
      defaultMapStyle: 'STREETS' | 'SATELLITE' | 'DARK';
      showUnassignedCustomers: boolean;
      heatmapIntensity: number;
    };
    scannerV2: {
      enabled: boolean;
    };
  };
  subscription?: {
    price?: number;
    currency?: string;
    billingCycle?: string;
    lastPaymentDate?: string;
    lastPaymentRef?: string;
    isVerified?: boolean;
    sysAdminDiscountPercent?: number;
    promoCode?: string;
    promoDiscountPercent?: number;
  };
}


export interface Route {
  id: string;
  company_id: string;
  region_id: string; // or region_code
  route_id: string; // or route_name
  day_id: string; // or day
  week_id?: string;
  version: number;
  is_active: boolean;
  customers: Customer[]; // Stored as JSONB
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface RouteVersion {
  id: string;
  route_pkey: string; // FK to customers.id
  version_number: number;
  change_summary?: string;
  created_at: string;
  created_by?: string;
  snapshot_data?: any; // JSONB
}

export interface HistoryLog {
  id: string;
  fileName: string;
  uploadDate: string;
  recordCount: number;
  uploader: string;
  type: 'ROUTE' | 'USERS';
  stats?: HistoryStats;
}

export interface RouteAssignment {
  id: string;
  companyId: string;
  routeName: string;
  userId: string; // The assigned driver's ID
  assignedAt?: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  USER = 'USER',
  DRIVER = 'DRIVER'
}

export interface UserPreferences {
  isDarkMode?: boolean;
  language?: 'en' | 'ar';
  uiMode?: 'classic' | 'modern';
  dockLayout?: string[];
  iconSize?: 'sm' | 'md' | 'lg';
  activeWidgets?: string[];
}

export interface User {
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string; // ISO Date String
  id?: string;
  companyId?: string; // For Multi-Tenancy
  // Managed Entities
  regionIds?: string[];
  branchIds?: string[];
  routeIds?: string[];
  repCodes?: string[];
  // New Onboarding Fields
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isRegisteredCustomer?: boolean;
  preferences?: UserPreferences;
}

export enum ViewMode {
  LOGIN = 'LOGIN',
  SYSADMIN_LOGIN = 'SYSADMIN_LOGIN',
  SYSADMIN_DASHBOARD = 'SYSADMIN_DASHBOARD',
  DASHBOARD = 'DASHBOARD',
  INSIGHTS = 'INSIGHTS',
  LEGACY_INSIGHTS = 'LEGACY_INSIGHTS',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  UPLOAD = 'UPLOAD',
  AI_SUGGESTIONS = 'AI_SUGGESTIONS',
  FULL_SUMMARY = 'FULL_SUMMARY',
  MARKET_SCANNER = 'MARKET_SCANNER',
  PRICING = 'PRICING',
  REACH_PRICING = 'REACH_PRICING',
  CUSTOMERS = 'CUSTOMERS',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  REFERRAL_HUB = 'REFERRAL_HUB',
  SYSADMIN_AFFILIATES = 'SYSADMIN_AFFILIATES',
  SCANNER_V2 = 'SCANNER_V2',
  ANALYZE_DATA = 'ANALYZE_DATA',
  LICENSE_SUMMARY = 'LICENSE_SUMMARY'
}
export interface BranchConfig {
  id: string; // UUID or unique slug
  name: string;
  code?: string;
  nameAr?: string;
  coordinates?: { lat: number; lng: number };
  address?: string;
  isActive: boolean;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  affiliate_percent?: number;
  description?: string;
  expires_at?: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  owner_id?: string; // Link to auth.users
  partner_first_name?: string;
  partner_last_name?: string;
  partner_company?: string;
  partner_email?: string;
  partner_phone?: string;
}


export interface DashboardInsights {
  kpis: {
    totalCustomers: number;
    activeRoutes: number;
    totalVisits: number;
    totalDistance: number;
    totalTime: number;
    avgVisitsPerRoute: number;
    timePerUser: number;
    frequency: number;
    efficiency: number;
  };
  routeHealth: {
    stable: number;
    under: number;
    over: number;
    total?: number;
    details?: any[];
  };
  alerts: {
    missingGps: number;
    proximityIssues: number;
  };
}
