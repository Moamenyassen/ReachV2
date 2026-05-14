import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, Map as MapIcon, Users, AlertTriangle, Scan, X, MapPinOff, Zap, Filter } from 'lucide-react';
import { Customer, RegionStats, RouteBreakdown, SkippedRecord } from '../../types';
import { APP_NAME, SAMPLE_CSV, BRANCHES } from '../../config/constants';
import Papa from 'papaparse';

export interface ImportStats {
  skipped: number;
  distinctSkipped: number;
  regions: string[];
  uniqueClients: number;
  regionBreakdown: RegionStats[];
  skippedDetails: SkippedRecord[];
  totalRowsParsed: number;
  totalRoutes: number; // In File
  totalUsers?: number; // New Field
  newRoutesCount: number; // New unique routes not in DB
  projectedTotalRoutes: number; // Existing + New
}

interface FileUploadProps {
  onDataLoaded: (data: Customer[], fileName: string, stats: ImportStats, mapping?: Record<string, string>, rawRows?: any[]) => void;
  maxRouteCap?: number;
  maxCustomerCap?: number; // New Prop for customer count limit
  existingRoutes?: string[];
  onExcessData?: (excessRows: any[]) => void;
  onUpgradePlan?: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, maxRouteCap, maxCustomerCap, onExcessData, onUpgradePlan, existingRoutes = [] }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  // State for analysis animation
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State for success modal
  const [successData, setSuccessData] = useState<Customer[] | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const [scanProgress, setScanProgress] = useState(0);
  // Default to TRUE to fix the immediate issue for the user
  const [useArabicEncoding, setUseArabicEncoding] = useState(true);
  // State for interactive mapping
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [mappingState, setMappingState] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawResults, setRawResults] = useState<Papa.ParseResult<any> | null>(null);

  const [isRouteExcluded, setIsRouteExcluded] = useState(false);

  // --- Helper: Fuzzy Column Matching ---
  const findColumnKey = (row: any, candidates: string[], customMapping?: Record<string, string>, fieldKey?: string): string | undefined => {
    // 0. Custom Mapping Override
    if (customMapping && fieldKey && customMapping[fieldKey]) {
      return customMapping[fieldKey];
    }

    const keys = Object.keys(row);
    // 1. Exact or Case-Insensitive Match
    for (const cand of candidates) {
      const exact = keys.find(k => k.toLowerCase().trim() === cand.toLowerCase().trim());
      if (exact) return exact;
    }
    // 2. Partial / Fuzzy Match (remove underscores, spaces)
    for (const cand of candidates) {
      const normalizedCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedCand);
      if (match) return match;
    }
    // 3. Includes Check (Weakest)
    for (const cand of candidates) {
      const match = keys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  };

  const detectAllColumns = (firstRow: any, customMapping?: Record<string, string>) => {
    return {
      lat: findColumnKey(firstRow, ['latitude', 'lat', 'y', 'lat_gps'], customMapping, 'lat'),
      lng: findColumnKey(firstRow, ['longitude', 'lng', 'long', 'x', 'lon', 'long_gps'], customMapping, 'lng'),
      name: findColumnKey(firstRow, ['client_descreption', 'Client_descreption', 'client_description', 'client_name', 'name', 'customer', 'customer_name', 'english_name'], customMapping, 'name'),
      nameAr: findColumnKey(firstRow, ['client_Arabic', 'Client_Arabic', 'arabic_name', 'name_ar', 'ar_name', 'customer_name_ar', 'client_name_ar', 'arabic'], customMapping, 'nameAr'),
      clientCode: findColumnKey(firstRow, ['r_Client_Code', 'Client_code', 'client_id', 'customer_id', 'customer_code'], customMapping, 'clientCode'),
      routeName: findColumnKey(firstRow, ['Route_Description', 'Route_name', 'route', 'journey', 'sales_route', 'route_code'], customMapping, 'routeName'),
      day: findColumnKey(firstRow, ['day', 'Day', 'visit_day', 'weekday', 'day_name'], customMapping, 'day'),
      // Region is SEPARATE from Branch
      regionDescription: findColumnKey(firstRow, ['Region_Description', 'Region', 'region_description', 'region_desc', 'region'], customMapping, 'regionDescription'),
      regionCode: findColumnKey(firstRow, ['Region_Code', 'region_code', 'region_id', 'code', 'Code'], customMapping, 'regionCode'),
      week: findColumnKey(firstRow, ['Week_Number', 'week', 'visit_week', 'cycle', 'week_no'], customMapping, 'week'),

      // Branch fields (separate from Region)
      branchCode: findColumnKey(firstRow, ['branch_code', 'Branch_Code', 'brcode', 'br_code'], customMapping, 'branchCode'),
      branch: findColumnKey(firstRow, ['Branch', 'branch', 'depot'], customMapping, 'branch'),
      address: findColumnKey(firstRow, ['Address', 'address', 'location_address', 'location', 'site'], customMapping, 'address'),
      phone: findColumnKey(firstRow, ['phone', 'Phone', 'mobile', 'contact', 'cell'], customMapping, 'phone'),
      district: findColumnKey(firstRow, ['district', 'District', 'neighborhood', 'area'], customMapping, 'district'),
      vat: findColumnKey(firstRow, ['vat', 'VAT', 'VAT_Number', 'vat_number', 'tax', 'tax_id', 'vat_no', 'tax_number'], customMapping, 'vat'),
      buyerId: findColumnKey(firstRow, ['buyer_identification_no', 'Buyer_ID', 'buyer_id', 'buyer_no', 'buyer'], customMapping, 'buyerId'),
      classification: findColumnKey(firstRow, ['Classification', 'classification', 'class', 'category'], customMapping, 'classification'),
      storeType: findColumnKey(firstRow, ['store_type', 'Store_type', 'Store_Type', 'type', 'channel'], customMapping, 'storeType'),
      userCode: findColumnKey(firstRow, ['User_Code', 'user_code', 'User_id', 'sales_rep_id', 'sales_man_id', 'driver_id', 'rep_code', 'driver'], customMapping, 'userCode'),
      visitOrder: findColumnKey(firstRow, ['Visit_Order', 'visit_order', 'order', 'sequence', 'stop_number'], customMapping, 'visitOrder'),
    };
  };

  const processParsedData = (results: Papa.ParseResult<any>, fName: string, customMapping?: Record<string, string>) => {
    try {
      if (results.data.length === 0) {
        throw new Error("File appears to be empty.");
      }

      console.log("DEBUG: Validation Check", { maxCustomerCap, maxRouteCap, rows: results.data.length });

      // 1. Detect Columns First (on ALL data)
      const firstRow = results.data[0];

      // Auto-Detect all keys
      const detected = detectAllColumns(firstRow, customMapping);

      // Capture headers for mapping UI & Pre-fill Mapping State if it's the first run
      if (!customMapping) {
        setCsvHeaders(Object.keys(firstRow));
        setRawResults(results);

        // SMART PRE-FILL: Initialize mapping state with what we found
        const initialMapping: Record<string, string> = {};
        Object.entries(detected).forEach(([key, val]) => {
          if (val) initialMapping[key] = val;
        });
        setMappingState(initialMapping);
      }

      // Destructure for use below
      const {
        lat: latKey, lng: lngKey, name: nameKey, nameAr: nameArKey, clientCode: codeKey,
        routeName: routeKey, day: dayKey, regionDescription: regionDescKey, regionCode: regionCodeKey,
        week: weekKey, branch: branchKey, address: addressKey, phone: phoneKey, district: districtKey,
        vat: vatKey, buyerId: buyerIdKey, classification: classificationKey, storeType: storeTypeKey,
        userCode: userCodeKey, visitOrder: visitOrderKey
      } = detected;

      // 2. Identify Unique Entities (Distinct Counting Logic)
      const uniqueClientIds = new Set<string>();
      const uniqueRouteNames = new Set<string>();
      const uniqueUserCodes = new Set<string>(); // New: Track Unique Users
      const allowedClientIds = new Set<string>();

      // Track clients who have at least ONE valid GPS coordinate
      const clientsWithValidGps = new Set<string>();

      const skippedDetails: SkippedRecord[] = [];

      // Branch tracking for stats (First Pass)
      const branchValidClients = new Map<string, Set<string>>();
      const branchSkippedClients = new Map<string, Set<string>>();
      const branchRouteSkippedCounts = new Map<string, Map<string, Set<string>>>();

      const addToBranchSet = (map: Map<string, Set<string>>, branch: string, id: string) => {
        if (!map.has(branch)) map.set(branch, new Set());
        map.get(branch)!.add(id);
      };

      // First Pass: Scan for Uniqueness & Stats (ALL DATA)
      results.data.forEach((row: any, index: number) => {
        // Skip empty rows
        const rowValues = Object.values(row);
        if (!rowValues.some(val => val !== null && val !== undefined && String(val).trim() !== '')) return;

        const name = nameKey ? (row[nameKey] || `Customer ${index + 1} `) : `Customer ${index + 1} `;
        const clientCode = codeKey ? row[codeKey] : undefined;

        // Helper: Generate Business Key for Uniqueness
        // Priority: Client Code -> Name
        const businessId = clientCode ? String(clientCode).trim() : String(name).trim();

        // Branch / Region Info for Stats
        let rawRegionDesc = regionDescKey ? row[regionDescKey] : undefined;
        let regionDescription = rawRegionDesc !== undefined && rawRegionDesc !== null ? String(rawRegionDesc).trim() : undefined;

        if (!regionDescription && branchKey) {
          const bVal = row[branchKey];
          if (bVal !== undefined && bVal !== null) regionDescription = String(bVal).trim();
        }

        const regionCodeRaw = regionCodeKey ? String(row[regionCodeKey]).trim() : undefined;
        let regionCode = regionCodeRaw;

        // Bidirectional Autofill (Branches)
        if (!regionDescription && regionCode) {
          const matchedBranch = BRANCHES.find(b => b.code === regionCode);
          if (matchedBranch) regionDescription = matchedBranch.name.replace(/ CONSUMER/i, '');
        }
        if (!regionCode && regionDescription) {
          const cleanDesc = String(regionDescription).toUpperCase().replace(/ CONSUMER/i, '').trim();
          const matchedBranch = BRANCHES.find(b => {
            const cleanBranchName = b.name.toUpperCase().replace(/ CONSUMER/i, '').trim();
            return cleanBranchName === cleanDesc || cleanBranchName.includes(cleanDesc) || cleanDesc.includes(cleanBranchName);
          });
          if (matchedBranch) regionCode = matchedBranch.code;
        }

        const currentBranch = regionDescription || "Unknown Branch";
        const displayBranch = (branchKey ? String(row[branchKey] || '').trim() : undefined) || currentBranch;


        if (businessId) {
          uniqueClientIds.add(businessId);
          addToBranchSet(branchValidClients, displayBranch, businessId); // Track presence

          // If we are within the cap (or no cap), add to allowed list
          if (!maxCustomerCap || maxCustomerCap >= 999999 || uniqueClientIds.size <= maxCustomerCap) {
            allowedClientIds.add(businessId);
          }
        }

        if (routeKey) {
          const rName = row[routeKey];
          if (rName && String(rName).trim() !== '') {
            // NORMALIZE: UpperCase to handle case-insensitive duplicates
            uniqueRouteNames.add(String(rName).trim().toUpperCase());
          }
        }

        if (userCodeKey) {
          const uCode = row[userCodeKey];
          if (uCode && String(uCode).trim() !== '') {
            uniqueUserCodes.add(String(uCode).trim());
          }
        }

        // --- GPS CHECK (District Logic) ---
        let latRaw = latKey ? row[latKey] : null;
        let lngRaw = lngKey ? row[lngKey] : null;
        let latVal = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
        let lngVal = typeof lngRaw === 'number' ? lngRaw : parseFloat(lngRaw);

        if (typeof latRaw === 'string' && latRaw.includes(',')) latVal = parseFloat(latRaw.replace(',', '.'));
        if (typeof lngRaw === 'string' && lngRaw.includes(',')) lngVal = parseFloat(lngRaw.replace(',', '.'));

        const isInvalidGPS = isNaN(latVal) || isNaN(lngVal) || latVal === 0 || lngVal === 0 || !latKey || !lngKey;

        if (!isInvalidGPS && businessId) {
          // Found a valid location for this client!
          clientsWithValidGps.add(businessId);
        }
      });

      const totalCustomers = uniqueClientIds.size; // Distinct Count
      const totalRoutes = uniqueRouteNames.size; // Distinct Routes (Normalized)
      const totalUsers = uniqueUserCodes.size;     // Distinct Users

      // Calculate New Routes
      const existingRouteSet = new Set((existingRoutes || []).map(r => r.toUpperCase().trim()));
      let newRoutesCount = 0;
      uniqueRouteNames.forEach(r => {
        if (!existingRouteSet.has(r)) newRoutesCount++;
      });
      const projectedTotalRoutes = existingRouteSet.size + newRoutesCount;

      console.log("DEBUG: File Stats (Distinct)", {
        totalCustomers,
        totalRoutes,
        totalUsers,
        uniqueRouteSamples: Array.from(uniqueRouteNames).slice(0, 10),
        newRoutesCount,
        projectedTotalRoutes,
        maxCustomerCap,
        maxRouteCap,
        clientsWithValidGps: clientsWithValidGps.size
      });

      // Recalculate Missing GPS: Clients who exist but NOT in valid set
      const missingGpsCount = totalCustomers - clientsWithValidGps.size;

      // 3. PLAN LIMIT CHECK (Distinct Based)
      let validRawData: any[] = [];
      let excessRawData: any[] = [];

      // Logic: Filter rows based on whether their Business ID is in the "allowed" set
      if (maxCustomerCap && maxCustomerCap < 999999 && totalCustomers > maxCustomerCap) {
        alert(`Customer Limit Exceeded.\n\nFile Stats:\n- Unique Clients: ${totalCustomers}\n\nYour Plan Limit:\n- Max Customers: ${maxCustomerCap}\n\nAction: The first ${maxCustomerCap} unique customers will be uploaded. The remaining will be archived.`);

        validRawData = results.data.filter((row: any, index: number) => {
          const rowValues = Object.values(row);
          if (!rowValues.some(val => val !== null && val !== undefined && String(val).trim() !== '')) return false;

          const name = nameKey ? (row[nameKey] || `Customer ${index + 1} `) : `Customer ${index + 1} `;
          const clientCode = codeKey ? row[codeKey] : undefined;
          const businessId = clientCode ? String(clientCode).trim() : String(name).trim();

          // Keep if this client is in the allowed set
          return allowedClientIds.has(businessId);
        });

        // Identify excess rows for potential archiving/download
        excessRawData = results.data.filter((row: any, index: number) => {
          const rowValues = Object.values(row);
          if (!rowValues.some(val => val !== null && val !== undefined && String(val).trim() !== '')) return false;

          const name = nameKey ? (row[nameKey] || `Customer ${index + 1} `) : `Customer ${index + 1} `;
          const clientCode = codeKey ? row[codeKey] : undefined;
          const businessId = clientCode ? String(clientCode).trim() : String(name).trim();

          return !allowedClientIds.has(businessId);
        });

        if (onExcessData && excessRawData.length > 0) {
          onExcessData(excessRawData);
        }

      } else {
        // No limit issues, use all data (but still filter empty rows)
        validRawData = results.data.filter((row: any) => {
          const rowValues = Object.values(row);
          return rowValues.some(val => val !== null && val !== undefined && String(val).trim() !== '');
        });
      }

      const customers: Customer[] = [];

      // 4. Iterate over VALIDATED & FILTERED Data to build Objects
      validRawData.forEach((row: any, index: number) => {
        // (No need to check empty rows again, done in filter)

        // Parse coordinates safely
        let latRaw = latKey ? row[latKey] : null;
        let lngRaw = lngKey ? row[lngKey] : null;

        let latVal = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
        let lngVal = typeof lngRaw === 'number' ? lngRaw : parseFloat(lngRaw);

        if (typeof latRaw === 'string' && latRaw.includes(',')) latVal = parseFloat(latRaw.replace(',', '.'));
        if (typeof lngRaw === 'string' && lngRaw.includes(',')) lngVal = parseFloat(lngRaw.replace(',', '.'));

        // GPS Valid/Invalid for Import purposes (If 0 is allowed as value, logic changes, but typically 0,0 is Null Island)
        const isInvalid = isNaN(latVal) || isNaN(lngVal) || latVal === 0 || lngVal === 0 || !latKey || !lngKey;
        if (isInvalid) {
          latVal = 0;
          lngVal = 0;
          // No need to track stats here, we use the "Zero Valid" logic now
        }

        const name = nameKey ? (row[nameKey] || `Customer ${index + 1} `) : `Customer ${index + 1} `;
        const clientCode = codeKey ? row[codeKey] : undefined;
        // Use Business ID consistently
        const businessId = clientCode ? String(clientCode).trim() : String(name).trim();

        // Priority: Region Desc Header -> Branch Header -> Undefined
        // Priority: Region Desc Header -> Branch Header -> Undefined
        let rawRegionDesc = regionDescKey ? row[regionDescKey] : undefined;
        let regionDescription = rawRegionDesc !== undefined && rawRegionDesc !== null ? String(rawRegionDesc).trim() : undefined;

        if (!regionDescription && branchKey) {
          const bVal = row[branchKey];
          if (bVal !== undefined && bVal !== null) {
            regionDescription = String(bVal).trim();
          }
        }

        const regionCodeRaw = regionCodeKey ? String(row[regionCodeKey]).trim() : undefined;
        let regionCode = regionCodeRaw;
        const routeName = routeKey ? row[routeKey] : undefined;
        const userCode = userCodeKey ? row[userCodeKey] : undefined;

        // Bidirectional Autofill (Branches)
        if (!regionDescription && regionCode) {
          const matchedBranch = BRANCHES.find(b => b.code === regionCode);
          if (matchedBranch) regionDescription = matchedBranch.name.replace(/ CONSUMER/i, '');
        }
        if (!regionCode && regionDescription) {
          const cleanDesc = String(regionDescription).toUpperCase().replace(/ CONSUMER/i, '').trim();
          const matchedBranch = BRANCHES.find(b => {
            const cleanBranchName = b.name.toUpperCase().replace(/ CONSUMER/i, '').trim();
            return cleanBranchName === cleanDesc || cleanBranchName.includes(cleanDesc) || cleanDesc.includes(cleanBranchName);
          });
          if (matchedBranch) regionCode = matchedBranch.code;
        }

        const currentBranch = regionDescription || "Unknown Branch";
        const displayBranch = (branchKey ? String(row[branchKey] || '').trim() : undefined) || currentBranch;

        // Apps uniqueID (row level)
        const uniqueRowId = clientCode ? `${clientCode}-${index}` : `cust-${index}`;

        // Identify unmapped keys for dynamic data
        const mappedKeys = new Set(Object.values(detected).filter(Boolean));
        const allKeys = Object.keys(row);
        const dynamicData: Record<string, any> = {};
        allKeys.forEach(k => {
          if (!mappedKeys.has(k)) {
            dynamicData[k] = row[k];
          }
        });

        customers.push({
          id: uniqueRowId,
          name: String(name).trim(),
          nameAr: nameArKey ? String(row[nameArKey]).trim() : undefined,
          lat: latVal,
          lng: lngVal,
          day: dayKey ? String(row[dayKey]).trim() : 'Any',
          clientCode: clientCode ? String(clientCode).trim() : undefined,
          routeName: routeName ? String(routeName).trim() : undefined,
          week: weekKey ? String(row[weekKey]).trim() : undefined,
          regionDescription: currentBranch, // Mapped to Region (or Branch fallback)
          regionCode: regionCode,

          // New Fields
          branch: branchKey ? String(row[branchKey] || '').trim() : undefined,
          address: addressKey ? String(row[addressKey] || '').trim() : undefined,
          phone: phoneKey ? String(row[phoneKey] || '').trim() : undefined,
          district: districtKey ? String(row[districtKey] || '').trim() : undefined,
          vat: vatKey ? String(row[vatKey] || '').trim() : undefined,
          buyerId: buyerIdKey ? String(row[buyerIdKey] || '').trim() : undefined,
          classification: classificationKey ? String(row[classificationKey] || '').trim() : undefined,
          storeType: storeTypeKey ? String(row[storeTypeKey] || '').trim() : undefined,
          userCode: userCode ? String(userCode).trim() : undefined,
          visitOrder: visitOrderKey && row[visitOrderKey] ? parseInt(String(row[visitOrderKey])) : undefined,
          reachCustomerCode: undefined, // Removed as per user request
          data: dynamicData // Capture all unmapped columns
        });
      });

      if (customers.length === 0) {
        throw new Error("File contains no valid data rows.");
      }

      // --- Stats Generation ---
      const allBranches = new Set([...Array.from(branchValidClients.keys())]);
      const uniqueBranches = Array.from(allBranches);

      // Calculate Distinct Clients vs Total Records
      // Actually successData.length is total records, uniqueClients is derived from 'customers' list based on code/name
      // But let's be distinct by 'clientCode' or 'name' from stats
      const uniqueClientsCount = uniqueClientIds.size; // From Pass 1

      const regionBreakdown: RegionStats[] = uniqueBranches.map(bName => {
        // Approximate skipped count for region (not perfect with new logic, but OK)
        // We can just fallback to 0 or leave it for now
        const skippedCount = branchSkippedClients.get(bName)?.size || 0;
        const routes: RouteBreakdown[] = [];

        if (branchRouteSkippedCounts.has(bName)) {
          branchRouteSkippedCounts.get(bName)!.forEach((clientSet, rName) => {
            routes.push({ name: rName, skipped: clientSet.size });
          });
        }

        return {
          name: bName,
          count: branchValidClients.get(bName)?.size || 0,
          skipped: skippedCount,
          routes: routes
        };
      }).sort((a, b) => b.count - a.count);

      setImportStats({
        totalRowsParsed: results.data.length,
        skipped: missingGpsCount, // Corrected: Distinct Clients with Zero Valid GPS
        distinctSkipped: missingGpsCount,
        regions: uniqueBranches,
        uniqueClients: uniqueClientsCount,
        regionBreakdown,
        skippedDetails,
        totalRoutes: totalRoutes,
        totalUsers: totalUsers, // Added missing field
        newRoutesCount,
        projectedTotalRoutes
      });

      setFileName(fName);
      // setSuccessData(customers); // REMOVED: Duplicate Modal
      // setError(null);

      // Auto-Proceed to Parent (App.tsx handles Confirmation now)
      onDataLoaded(customers, fName, {
        totalRowsParsed: results.data.length,
        skipped: missingGpsCount,
        distinctSkipped: missingGpsCount,
        regions: uniqueBranches,
        uniqueClients: uniqueClientsCount,
        regionBreakdown,
        skippedDetails,
        totalRoutes: totalRoutes,
        totalUsers: totalUsers,
        newRoutesCount,
        projectedTotalRoutes
      }, detected, validRawData);

      // Cleanup local state
      setIsAnalyzing(false);
      setSuccessData(null);
      setImportStats(null);


    } catch (e: any) {
      if (e.message !== "ABORTED") {
        const msg = e.message || "Failed to parse CSV.";
        setError(msg);
      }
      setSuccessData(null);
      setImportStats(null);
      console.error("CSV Processing Error:", e);
    }
  };

  const handleCancel = () => {
    setSuccessData(null);
    setImportStats(null);
    setFileName('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProceed = () => {
    if (successData && importStats) {
      if (isRouteExcluded) {
        // Strip route information from all customers
        const strippedData = successData.map(c => ({ ...c, routeName: '' }));
        onDataLoaded(strippedData, fileName, {
          ...importStats,
          totalRoutes: 0,
          newRoutesCount: 0,
          projectedTotalRoutes: (existingRoutes?.length || 0)
        });
      } else {
        onDataLoaded(successData, fileName, importStats);
      }
      setSuccessData(null);
      setImportStats(null);
      setIsAnalyzing(false);
      setIsRouteExcluded(false);
    }
  };

  const handleImportWithoutRoutes = () => {
    setIsRouteExcluded(true);
  };

  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAnalyzing(false);
    setScanProgress(0);
    setSuccessData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (file: File) => {
    setError(null);
    setSuccessData(null);
    setImportStats(null);
    setIsAnalyzing(true);
    setScanProgress(0);

    // Create a new AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Simulate progressive scanning
    // Since we use a worker now, this interval will run smoothly without blocking!
    let progress = 0;
    const interval = setInterval(() => {
      if (signal.aborted) {
        clearInterval(interval);
        return;
      }
      // Increment progress but slow down as it gets higher
      const increment = Math.max(0.5, (100 - progress) / 20);
      progress += Math.random() * increment;

      if (progress > 95) progress = 95; // Hold at 95 until done
      setScanProgress(Math.min(100, Math.floor(progress)));
    }, 100);

    // Small delay to show "Initializing" state
    setTimeout(() => {
      if (signal.aborted) return;

      // Use PapaParse directly with Worker support (Non-blocking)
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: 'greedy',

        worker: true, // Offloads parsing to a separate thread
        encoding: useArabicEncoding ? 'windows-1256' : 'utf-8',
        complete: (results) => {
          clearInterval(interval);
          setScanProgress(100);

          if (signal.aborted) return;

          // Artificial delay at 100% for satisfaction
          setTimeout(() => {
            if (signal.aborted) return;
            setIsAnalyzing(false);

            if (results.errors.length > 0 && results.data.length === 0) {
              setError(`CSV Parsing Error: ${results.errors[0].message} `);
            } else {
              processParsedData(results, file.name);
            }
          }, 500);
        },
        error: (err) => {
          clearInterval(interval);
          setIsAnalyzing(false);
          if (!signal.aborted) {
            setError(`PapaParse Error: ${err.message} `);
          }
        }
      });
    }, 1000);
  };

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reach_Data_Import_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto relative group/container">
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-[2.5rem] blur opacity-20 group-hover/container:opacity-40 transition duration-1000 group-hover/container:duration-200 pointer-events-none"></div>

      <div
        className={`relative bg-white dark:bg-gray-900 border-2 rounded-[2.5rem] p-12 text-center transition-all duration-500 cursor-pointer overflow-hidden ${isDragOver
          ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-900/10 scale-[1.02] shadow-2xl shadow-indigo-500/20'
          : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 shadow-xl'
          }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className={`relative z-10 w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center transition-all duration-500 ${isDragOver ? 'scale-110' : ''}`}>
          <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400 to-violet-500 blur-xl opacity-20 animate-pulse`}></div>
          <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-700 shadow-lg">
            <Upload className={`w-10 h-10 ${isDragOver ? 'text-indigo-500 animate-bounce' : 'text-gray-400 dark:text-gray-500'}`} />
          </div>

          {/* Satellite Orbits */}
          {isDragOver && (
            <>
              <div className="absolute inset-0 border border-indigo-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
              <div className="absolute -inset-4 border border-cyan-500/20 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
            </>
          )}
        </div>

        <h3 className="relative z-10 text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
          Upload Route Master
        </h3>
        <p className="relative z-10 text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto text-lg font-medium leading-relaxed">
          Drag & drop your CSV file to initialize system ingestion.
        </p>

        <div className="relative z-10 flex flex-wrap justify-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
            <input
              title="Fix Arabic Encoding"
              type="checkbox"
              checked={useArabicEncoding}
              onChange={(e) => setUseArabicEncoding(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Fix Arabic (Windows-1256)</span>
          </label>

        </div>

        <input
          title="Select File"
          type="file"
          ref={fileInputRef}
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />

        {error && (
          <div className="absolute inset-x-8 bottom-8 p-4 bg-red-50/90 dark:bg-red-900/30 backdrop-blur-md text-red-600 dark:text-red-300 rounded-2xl flex items-center gap-3 text-sm border border-red-200 dark:border-red-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 z-20">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
          className="relative z-20 group flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-6 py-3 rounded-2xl hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
        >
          <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
          Download CSV Template
        </button>
      </div>

      {/* Analyzing/Loading Modal Overlay - MAGIC REDESIGN */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-700">
          {/* Ambient Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-black to-black opacity-80 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

          <div className="relative flex flex-col items-center w-full max-w-md">

            {/* Magic Scanning Core */}
            <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
              {/* Outer Orbital Rings */}
              <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-[spin_3s_linear_infinite] border-t-transparent border-b-transparent"></div>
              <div className="absolute inset-2 border border-violet-500/30 rounded-full animate-[spin_5s_linear_infinite_reverse] border-l-transparent border-r-transparent"></div>
              <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full animate-pulse"></div>

              {/* Inner Glowing Core */}
              <div className="absolute w-24 h-24 bg-gradient-to-tr from-cyan-500 to-violet-600 rounded-full blur-[50px] animate-pulse opacity-60"></div>
              <div className="relative w-32 h-32 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                <Scan className="w-12 h-12 text-cyan-400 animate-[pulse_2s_ease-in-out_infinite]" />
              </div>

              {/* Orbital Particles (CSS representation) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-2 bg-cyan-400 blur-[1px] rounded-full shadow-[0_0_10px_cyan]"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-2 bg-violet-400 blur-[1px] rounded-full shadow-[0_0_10px_violet]"></div>
            </div>

            {/* Status Text with "Typing" effect logic simulated by pure CSS/Changes */}
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight animate-pulse">
                INITIALIZING CORE
              </h3>
              <p className="text-cyan-300/80 font-mono text-xs tracking-[0.2em] uppercase">
                Parsing Sector Data... {scanProgress}%
              </p>
            </div>

            {/* High-Tech Progress Bar */}
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-8 relative">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-600 transition-all duration-300 ease-out box-shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                style={{ width: `${scanProgress}% ` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/50 blur-[4px]"></div>
              </div>
            </div>

            {/* Abort Button */}
            <button
              onClick={cancelAnalysis}
              className="group relative px-6 py-2 overflow-hidden rounded-lg bg-red-500/10 border border-red-500/30 hover:border-red-500/60 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-red-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative flex items-center gap-2 text-xs font-bold text-red-400 group-hover:text-red-100 uppercase tracking-wider">
                <X className="w-3 h-3" />
                Abort Sequence
              </span>
            </button>

          </div>
        </div>
      )}



      {/* Column Mapper Modal */}
      {
        showColumnMapper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl p-6 max-w-4xl w-full border border-gray-200 dark:border-gray-800 h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Map CSV Columns</h2>
                <button
                  onClick={() => setShowColumnMapper(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Field List */}
                  {[
                    { key: 'clientCode', label: 'Client Code', required: false },
                    { key: 'name', label: 'Client Name', required: true },
                    { key: 'nameAr', label: 'Arabic Name', required: false },
                    { key: 'lat', label: 'Latitude (GPS)', required: true },
                    { key: 'lng', label: 'Longitude (GPS)', required: true },
                    { key: 'branch', label: 'Branch / Depot', required: false },
                    { key: 'phone', label: 'Phone Number', required: false },
                    { key: 'address', label: 'Address', required: false },
                    { key: 'district', label: 'District', required: false },
                    { key: 'vat', label: 'VAT Number', required: false },
                    { key: 'buyerId', label: 'Buyer ID', required: false },
                    { key: 'classification', label: 'Classification', required: false },
                    { key: 'storeType', label: 'Store Type', required: false },
                    { key: 'regionDescription', label: 'Region', required: false },
                    { key: 'routeName', label: 'Route Name', required: false },
                  ].map((field) => (
                    <div key={field.key} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {mappingState[field.key] ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Mapped</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600">Unmapped</span>
                        )}
                      </div>
                      <select
                        title={`Select column for ${field.label}`}
                        value={mappingState[field.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMappingState(prev => ({ ...prev, [field.key]: val === '' ? undefined : val }));
                        }}
                        className="w-full text-xs p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <div className="mt-2 text-[10px] text-gray-400 truncate">
                        Preview: {successData && successData.length > 0 && mappingState[field.key] ? (
                          rawResults?.data?.[0]?.[mappingState[field.key]] || 'No Data'
                        ) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 shrink-0 flex justify-end gap-3">
                <button
                  onClick={() => setShowColumnMapper(false)}
                  className="px-6 py-3 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Re-run processing with new map
                    if (rawResults) {
                      processParsedData(rawResults, fileName, mappingState);
                      setShowColumnMapper(false);
                    }
                  }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Apply Mapping
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default FileUpload;
