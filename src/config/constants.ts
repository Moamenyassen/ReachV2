
import { MapPin, Truck, Calendar, FileSpreadsheet } from 'lucide-react';
import { Branch, CompanySettings } from '../types';

export const APP_NAME = "Reach";
export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Average speed assumed for estimation (km/h)
export const AVG_SPEED_KMH = 35;
// Average service time per stop (minutes) - Updated to 20 mins per customer
export const SERVICE_TIME_MIN = 20;
// Factor to convert Haversine (Air) distance to estimated Driving distance (1.4 = 40% more for urban roads)
export const DRIVING_DISTANCE_FACTOR = 1.4;
// Traffic congestion multiplier for working hours (9:00 AM - 11:59 PM)
// A factor of 1.35 accounts for urban traffic delays during business hours
export const TRAFFIC_FACTOR = 1.35;

export const COUNTRIES_DATA: Record<string, string[]> = {
  "Saudi Arabia": [
    "Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail",
    "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jouf", "Qassim"
  ],
  "United Arab Emirates": [
    "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"
  ],
  "Egypt": [
    "Cairo", "Alexandria", "Giza", "Qalyubia", "Port Said", "Suez", "Luxor", "Aswan"
  ]
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  common: {
    general: {
      currency: 'SAR',
      distanceUnit: 'km',
      language: 'en',
      dataRetentionDays: 90
    },
    theme: {
      enableDarkMode: true,
      uiMode: 'modern'
    }
  },
  modules: {
    insights: {
      enabled: true,
      minClientsPerRoute: 80,
      maxClientsPerRoute: 120,
      efficiencyThreshold: 60,
      visitFrequencyDays: 7,
      workingDaysPerWeek: 6,
      churnThresholdDays: 60,
      nearbyRadiusMeters: 100
    },
    market: {
      enabled: true,
      searchTimeoutSeconds: 35,
      minZoomLevel: 13,
      enableDeepScan: true,
      defaultKeywords: 'grocery;supermarket;convenience',
      exportFormat: 'csv',
      maxLeadsPerScan: 500
    },
    optimizer: {
      enabled: true,
      avgSpeedKmh: 35,
      serviceTimeMin: 20,
      trafficFactor: 1.35,
      maxWorkingHours: 10,
      fuelCostPerKm: 0.15,
      driverHourlyRate: 20,
      startLocation: 'DEPOT',
      maxDistancePerRouteKm: 200,
      breakTimeMin: 30,
      costObjective: 'BALANCED'
    },
    map: {
      enabled: true,
      defaultCenter: [24.7136, 46.6753], // Riyadh
      defaultZoom: 12,
      showTraffic: true,
      clusterMarkers: true,
      defaultMapStyle: 'STREETS',
      showUnassignedCustomers: true,
      heatmapIntensity: 0.6
    },
    scannerV2: {
      enabled: true
    }
  }
};

export const SAMPLE_CSV = `Route_name,User_Code,Branch_Code,Branch_Name,Region,Client_code,client_description,Client_Arabic,longitude,latitude,Address,Phone,Week_Number,Day,Visit_Order,District,VAT_Number,Buyer_ID,Classification,Store_Type
Route A (101),101,10,Central Branch,Central,10001,Sunny Supermarket,سوبرماركت مشمس,46.6753,24.7136,Main Street,0500000001,W1,Sunday,1,Downtown,300000000000001,1000000001,A,Supermarket
Route A (101),101,10,Central Branch,Central,10002,Quick Stop Grocery,بقالة التوقف السريع,46.6800,24.7200,Side Street,0500000002,W1,Sunday,2,Downtown,300000000000002,1000000002,B,Grocery
Route B (102),102,10,Central Branch,Central,20001,Family Market,سوق العائلة,46.6900,24.7300,Market Road,0500000003,W1,Monday,1,Uptown,300000000000003,1000000003,A,Minimarket
Route B (102),102,10,Central Branch,Central,20002,Corner Shop,متجر الزاوية,46.7000,24.7400,Park Avenue,0500000004,W1,Monday,2,Uptown,300000000000004,1000000004,C,Grocery`;

export const MAP_LAYERS = {
  VOYAGER: {
    name: 'Standard',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  GOOGLE_TRAFFIC: {
    name: 'Google Traffic',
    url: 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  },
  SATELLITE: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  DARK: {
    name: 'Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  STREETS: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

export const BRANCHES: Branch[] = [
  { code: '27', name: 'TABOUK CONSUMER', lat: 28.3901209, lng: 36.5604334 },
  { code: '21', name: 'JEDDAH CONSUMER', lat: 21.31452, lng: 39.21622 },
  { code: '26', name: 'MADINA CONSUMER', lat: 24.442579, lng: 39.569843 },
  { code: '22', name: 'MAKKAH CONSUMER', lat: 21.38386, lng: 39.71447 },
  { code: '37', name: 'ALSKAKA CONSUMER', lat: 29.9516932, lng: 40.217271 },
  { code: '23', name: 'TAIF CONSUMER', lat: 21.3581, lng: 40.4128 },
  { code: '25', name: 'JIZZAN CONSUMER', lat: 16.88608, lng: 42.57647 },
  { code: '24', name: 'KHAMIS CONSUMER', lat: 18.32031, lng: 42.73187 },
  { code: '28', name: 'BURAIDA CONSUMER', lat: 26.2817, lng: 44.01358 },
  { code: '36', name: 'HAFR BATIN CONSUMER', lat: 28.3995964, lng: 45.9590654 },
  { code: '29', name: 'RIYADH CONSUMER', lat: 24.62726, lng: 46.85364 },
  { code: '35', name: 'ALHASSA CONSUMER', lat: 25.45713, lng: 49.56086 },
  { code: '30', name: 'DAMMAM CONSUMER', lat: 26.40812, lng: 50.14086 }
];

export const TRANSLATIONS = {
  en: {
    // Sidebar
    dashboard: "Dashboard",
    mapView: "Route Sequence",
    toolsReports: "AI Tools",
    detailedReports: "Detailed Reports",
    customers: "Customers",
    marketScanner: "Market Scanner",
    routeOptimizer: "AI Optimizer",
    settings: "Settings",
    system: "System",
    main: "Main",
    operations: "Operations",
    configuration: "Configuration",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",
    english: "English",
    arabic: "Arabic",
    dataCenter: "Data Center",
    changePassword: "Change Password",
    pricing: "Pricing & Plans",
    partnerProgram: "Partner Program",
    systemConfig: "System Config",
    opportunityScanner: "Opportunity Scanner",

    // Insights Dashboard
    insightsTitle: "Insights Dashboard",
    insights: "Insights",
    systemOp: "System Operational",
    geoCoverage: "Geographic Coverage",
    visualizingPoints: "Visualizing points",
    healthCheck: "Health Check",
    alerts: "Alerts",
    activeRoutes: "Active Routes",
    portfolio: "Portfolio",
    plannedVisits: "Planned Visits",
    avgVisitsRoute: "Avg Visits / Route",
    totalDistance: "Total Distance",
    travelTime: "Total Time",
    efficiency: "Efficiency",
    missingGps: "Missing GPS",
    tooCloseBranch: "Too Close to Branch",
    clients: "Clients",
    filtered: "Filtered",
    km: "km",
    actionNeeded: "Action Needed",
    routeHealthMatrix: "Route Health Matrix",
    healthTarget: "Target: 80 - 120 Clients per Route.",
    underUtilized: "Under-Utilized",
    overloaded: "Overloaded",
    healthy: "Healthy",
    avgFrequency: "Avg Frequency",

    // Executive Dashboard
    execDashboardTitle: "Executive Insights",
    execDashboardSubtitle: "Strategic overview of network performance and health",
    shareInsights: "Share Insights",
    shareView: "Share View",
    copySummary: "Copy Summary",
    shareEmail: "Share via Email",
    activeUniverse: "Active Universe",
    uniqueClients: "Unique Clients",
    totalThroughput: "Total Throughput",
    totalVisits: "Total Visits",
    visitsPerClient: "Visits per Client",
    burnoutAnalysis: "Burnout Analysis",
    maxPeak: "Max Peak",
    gpsReadiness: "GPS Readiness",
    ready: "Ready",
    missing: "Missing",
    totalAnalyzedRoutes: "Total Analyzed Routes",
    needsMerging: "Needs Merging",
    optimal: "Optimal",
    needsSplitting: "Needs Splitting",

    // Scanner
    scannerTitle: "AI Market Scanner",
    scannerSubtitle: "Lead Generation Tool (KSA • Grocery Only)",
    filterBranch: "Filter Branch",
    exportLeads: "Export Leads",
    scanningArea: "Scanning Area...",
    queryingDb: "Querying OpenStreetMap database",
    newLeadsFound: "New Leads Found",
    scanAreaBtn: "Scan Area for Leads",
    scanning: "Scanning...",
    distinctClients: "Distinct Clients",
    filteredByBranch: "Filtered by Branch",
    systemStatus: "System Status",
    scanningSector: "SCANNING SECTOR",
    systemReady: "SYSTEM READY",
    totalTargets: "Total Targets",
    activeBranch: "Active Branch",
    navigateToTarget: "Navigate to Target",
    targetType: "Targeting: Grocery • Convenience • Supermarkets",

    // Optimizer
    optimizerTitle: "AI Route Optimizer",
    optimizerSubtitle: "Smart algorithms analyze your network to identify customers who are geographically isolated from their route but close to another, suggesting swaps to reduce mileage.",
    excludeRoutes: "Exclude Routes",
    exportCsv: "Export CSV",
    opportunities: "Opportunities",
    distSavings: "Distance Savings",
    timeSavings: "Time Savings",
    networkOptimized: "Network Optimized",
    customerProfile: "Customer Profile",
    optProposal: "Optimization Proposal",
    aiReasoning: "AI Reasoning",
    impact: "Impact",
    action: "Action",
    visualize: "Visualize",
    closeProof: "Close Proof",
    currentPath: "Current Path",
    suggestedMove: "Suggested Move",
    targetNeighbors: "Target Neighbors",
    geoVerification: "Geographic Verification",
    efficiencyGain: "Efficiency Gain",
    savedPerTrip: "Saved per Trip",
    optimizedPath: "Optimized Path",
    distToCurrent: "Dist to Current",
    distToTarget: "Dist to Target",

    // Common
    backHome: "Back Home",
    filters: "Filters",
    allRegions: "All Regions",
    allWeeks: "All Weeks",
    allDays: "All Days",
    allRoutes: "All Routes",
    allBranches: "All Branches",
    reset: "Reset",

    // Route Sequence (Dashboard)
    routeSequence: "Route Sequence",
    salesRoutePlan: "Route Sequence",
    printPreview: "Print Preview",
    exitPreview: "Exit Preview",
    processing: "Processing...",
    executeFilter: "Generate Sequence",
    refreshData: "Refresh Data",
    readyToPlan: "Ready to Sequence",
    readyDesc: "Select your filters above to generate an optimized route sequence with AI-powered insights.",
    branch: "Branch",
    stops: "stops",
    prodTime: "productive",
    routeFlow: "Route Flow Analysis",
    avgLeg: "Avg Leg",
    maxLeg: "Max Leg",
    smartInsights: "Smart Insights",
    regenerate: "Regenerate",
    analyzing: "Analyzing...",
    clientSequence: "Visit Sequence",
    showOpp: "Show Opportunities",
    optOpp: "Optimization Opportunity",
    saveTime: "Save Time",
    moveTo: "Move to",
    visualizeFix: "Visualize Fix",

    // Admin / Data Center
    uploadHistory: "Upload History",
    uploadMaster: "Upload Master",
    routeManagement: "Routes",
    userManagement: "User Management",
    registeredUsers: "Registered Users",
    bulkImport: "Bulk Import",
    addNewUser: "Add New User",
    username: "Username",
    password: "Password",
    role: "Role",
    assignedBranches: "Assigned Branches",
    status: "Status",
    actions: "Actions",
    createUser: "Create User",
    saveChanges: "Save Changes",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    passwordUpdated: "Password updated successfully!",
    passwordMismatch: "Current password incorrect.",
    cancel: "Cancel",
    update: "Update",

    // Summary Report
    fullPerfSummary: "Performance Summary",
    entity: "Entity (Branch / Route)",
    distinctCust: "Distinct Cust",
    visits: "Visits",
    nearby: "Nearby",
    estDist: "Avg Daily Dist",
    estTime: "Avg Daily Time",
    effScore: "Efficiency",
    lowPortfolioOnly: "Low Portfolio Only",
    exportReport: "Export Report",

    // AI Chat
    aiChat: {
      title: "Reach Analyst",
      subtitle: "Online • Connected",
      placeholder: "Ask about your data...",
      greeting: "Hello! I'm your Reach Analyst. Ask me about your efficiency, route health, or how to optimize your network.",
      suggestions: ['Why is efficiency low?', 'Analyze Route Health', 'How to reduce distance?']
    },
    loadMore: "Load More Customers"
  },
  ar: {
    // Sidebar
    dashboard: "لوحة التحكم",
    mapView: "تسلسل الزيارات",
    toolsReports: "أدوات الذكاء الاصطناعي",
    detailedReports: "التقارير التفصيلية",
    customers: "العملاء",
    marketScanner: "رادار السوق",
    routeOptimizer: "محسّن المسارات",
    settings: "الإعدادات",
    system: "النظام",
    main: "الرئيسية",
    operations: "العمليات",
    configuration: "الإعداد",
    lightMode: "الوضع الفاتح",
    darkMode: "الوضع الداكن",
    english: "English",
    arabic: "العربية",
    dataCenter: "مركز البيانات",
    changePassword: "تغيير كلمة المرور",
    pricing: "الباقات والأسعار",
    partnerProgram: "برنامج الشراكة",
    systemConfig: "إعداد النظام",
    opportunityScanner: "رادار الفرص",

    // Insights Dashboard
    insightsTitle: "لوحة التحليلات",
    insights: "التحليلات",
    systemOp: "النظام يعمل بشكل طبيعي",
    geoCoverage: "التغطية الجغرافية",
    visualizingPoints: "عرض نقاط",
    healthCheck: "فحص الأداء",
    alerts: "التنبيهات",
    activeRoutes: "المسارات النشطة",
    portfolio: "محفظة العملاء",
    plannedVisits: "الزيارات المجدولة",
    avgVisitsRoute: "متوسط الزيارات / مسار",
    totalDistance: "إجمالي المسافة",
    travelTime: "إجمالي وقت التنقل",
    efficiency: "كفاءة المسار",
    missingGps: "بيانات GPS مفقودة",
    tooCloseBranch: "قريب جداً من الفرع",
    clients: "عميل",
    filtered: "بعد التصفية",
    km: "كم",
    actionNeeded: "يحتاج مراجعة",
    routeHealthMatrix: "مصفوفة أداء المسارات",
    healthTarget: "المستهدف: ٨٠ - ١٢٠ عميل لكل مسار.",
    underUtilized: "طاقة فائضة",
    overloaded: "مُحمَّل بشكل زائد",
    healthy: "أداء جيد",
    avgFrequency: "متوسط تكرار الزيارة",

    // Executive Dashboard
    execDashboardTitle: "لوحة القيادة التنفيذية",
    execDashboardSubtitle: "نظرة شاملة على أداء الشبكة وصحة المسارات",
    shareInsights: "مشاركة التقرير",
    shareView: "مشاركة العرض",
    copySummary: "نسخ الملخص",
    shareEmail: "إرسال بالبريد الإلكتروني",
    activeUniverse: "إجمالي قاعدة العملاء",
    uniqueClients: "عملاء غير مكررين",
    totalThroughput: "الإنتاجية الإجمالية",
    totalVisits: "إجمالي الزيارات",
    visitsPerClient: "معدل الزيارات لكل عميل",
    burnoutAnalysis: "تحليل ضغط العمل",
    maxPeak: "أعلى حمل",
    gpsReadiness: "جاهزية بيانات GPS",
    ready: "مكتملة",
    missing: "ناقصة",
    totalAnalyzedRoutes: "المسارات المحللة",
    needsMerging: "يُنصح بالدمج",
    optimal: "أداء مثالي",
    needsSplitting: "يُنصح بالتقسيم",

    // Scanner
    scannerTitle: "رادار السوق الذكي",
    scannerSubtitle: "أداة اكتشاف العملاء المحتملين (المملكة العربية السعودية • قطاع البقالة)",
    filterBranch: "تصفية حسب الفرع",
    exportLeads: "تصدير قائمة العملاء",
    scanningArea: "جاري مسح المنطقة...",
    queryingDb: "جاري البحث في قاعدة بيانات OpenStreetMap",
    newLeadsFound: "عميل محتمل تم اكتشافه",
    scanAreaBtn: "مسح المنطقة بحثاً عن فرص",
    scanning: "جاري المسح...",
    distinctClients: "عميل مكتشف",
    filteredByBranch: "نتائج الفرع المحدد",
    systemStatus: "حالة النظام",
    scanningSector: "جاري مسح القطاع",
    systemReady: "النظام جاهز للعمل",
    totalTargets: "إجمالي المواقع المكتشفة",
    activeBranch: "الفرع الحالي",
    navigateToTarget: "التنقل إلى الموقع",
    targetType: "المستهدف: بقالات • تموينات • هايبر ماركت",

    // Optimizer
    optimizerTitle: "محسّن المسارات الذكي",
    optimizerSubtitle: "يحلل النظام شبكتك ويكشف العملاء الذين يمكن نقلهم لمسارات أقرب جغرافياً، مع توصية باليوم الأنسب لتوفير الوقت والمسافة.",
    excludeRoutes: "استثناء مسارات",
    exportCsv: "تصدير CSV",
    opportunities: "توصيات",
    distSavings: "وفر في المسافة",
    timeSavings: "وفر في الوقت",
    networkOptimized: "الشبكة مُحسَّنة",
    customerProfile: "بيانات العميل",
    optProposal: "اقتراح التحسين",
    aiReasoning: "تحليل الذكاء الاصطناعي",
    impact: "الأثر",
    action: "إجراء",
    visualize: "عرض على الخريطة",
    closeProof: "إغلاق الخريطة",
    currentPath: "المسار الحالي",
    suggestedMove: "النقل المقترح",
    targetNeighbors: "العملاء المجاورون",
    geoVerification: "التحقق الجغرافي",
    efficiencyGain: "تحسن الكفاءة",
    savedPerTrip: "الوفر لكل رحلة",
    optimizedPath: "المسار الموصى به",
    distToCurrent: "المسافة من المسار الحالي",
    distToTarget: "المسافة من المسار المقترح",

    // Common
    backHome: "الرئيسية",
    filters: "الفلاتر",
    allRegions: "جميع المناطق",
    allWeeks: "جميع الأسابيع",
    allDays: "جميع الأيام",
    allRoutes: "جميع المسارات",
    allBranches: "جميع الفروع",
    reset: "إعادة ضبط",

    // Route Sequence (Dashboard)
    routeSequence: "تسلسل الزيارات",
    salesRoutePlan: "خطة زيارات المندوب",
    printPreview: "معاينة قبل الطباعة",
    exitPreview: "إغلاق المعاينة",
    processing: "جاري المعالجة...",
    executeFilter: "توليد التسلسل",
    refreshData: "تحديث البيانات",
    readyToPlan: "جاهز لإنشاء التسلسل",
    readyDesc: "اختر الفلاتر أعلاه لإنشاء تسلسل زيارات مُحسَّن بالذكاء الاصطناعي.",
    branch: "الفرع",
    stops: "نقطة توقف",
    prodTime: "وقت مُنتج",
    routeFlow: "تحليل سير المسار",
    avgLeg: "متوسط المقطع",
    maxLeg: "أطول مقطع",
    smartInsights: "توصيات ذكية",
    regenerate: "إعادة التوليد",
    analyzing: "جاري التحليل...",
    clientSequence: "ترتيب الزيارات",
    showOpp: "عرض الفرص",
    optOpp: "فرصة لتحسين المسار",
    saveTime: "وفر الوقت",
    moveTo: "نقل إلى",
    visualizeFix: "عرض التعديل على الخريطة",

    // Admin
    uploadHistory: "سجل الرفع",
    uploadMaster: "رفع الملف الرئيسي",
    routeManagement: "إدارة المسارات",
    userManagement: "إدارة المستخدمين",
    registeredUsers: "المستخدمون المسجلون",
    bulkImport: "استيراد جماعي",
    addNewUser: "إضافة مستخدم جديد",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    role: "صلاحية الوصول",
    assignedBranches: "الفروع المخصصة",
    status: "الحالة",
    actions: "الإجراءات",
    createUser: "إنشاء مستخدم",
    saveChanges: "حفظ التغييرات",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmNewPassword: "تأكيد كلمة المرور الجديدة",
    passwordUpdated: "تم تغيير كلمة المرور بنجاح",
    passwordMismatch: "كلمة المرور الحالية غير صحيحة",
    cancel: "إلغاء",
    update: "تحديث",

    // Summary
    fullPerfSummary: "ملخص الأداء الشامل",
    entity: "الجهة (فرع / مسار)",
    distinctCust: "عملاء غير مكررين",
    visits: "الزيارات",
    nearby: "العملاء المجاورون",
    estDist: "متوسط المسافة اليومية",
    estTime: "متوسط وقت التنقل اليومي",
    effScore: "مؤشر الكفاءة",
    lowPortfolioOnly: "المحافظ الصغيرة فقط",
    exportReport: "تصدير التقرير",

    // AI Chat
    aiChat: {
      title: "محلل Reach الذكي",
      subtitle: "متصل • جاهز للتحليل",
      placeholder: "اسألني عن بياناتك...",
      greeting: "مرحباً! أنا محلل Reach الذكي. اسألني عن كفاءة مسارك، أداء الفريق، أو كيف يمكنك تقليل المسافة وتوفير الوقت.",
      suggestions: ['لماذا تنخفض الكفاءة؟', 'كيف أُقيّم أداء المسارات؟', 'كيف أقلل مسافة التنقل؟']
    },
    loadMore: "تحميل المزيد من العملاء"
  }
};
