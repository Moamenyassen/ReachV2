// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Customer, CompanySettings, NormalizedBranch, UserRole } from '../../../types';
import { DEFAULT_COMPANY_SETTINGS } from '../../../config/constants';
import { calculateDistance } from '../../../services/optimizer';
import { supabase, getBranches } from '../../../services/supabase';
import { createUserLocationIcon } from '../../../services/mapIcons';
import {
    ArrowLeft, Navigation, Radar, Loader2, Building2, ChevronsUpDown,
    Check, X, Search, Sparkles, MapPin, Phone, Store, Eye, EyeOff,
    AlertTriangle, Target, Filter, Pill, Stethoscope, ShoppingCart,
    PawPrint, Fuel, Hospital, ShoppingBag, ListChecks, Layers,
    CheckCircle2, Trash2, LocateFixed,
    Coffee, Cake, Cookie, CupSoda, ChefHat, Beef
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const OVERPASS_MIRRORS = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
];

const canvasRenderer = L.canvas({ padding: 0.5 });

// Distance threshold (km) for considering a lead "already a customer"
// Geographic threshold: leads within this distance of any customer are treated as duplicates and excluded
const DUPLICATE_THRESHOLD_KM = 0.02; // 20 meters (per user requirement)
// Wider geographic threshold used together with name match — catches GPS drift where the location
// is slightly off but the business is clearly the same.
const NAME_MATCH_RADIUS_KM = 0.10;   // 100 meters

// Normalize a name for comparison: lowercase, strip diacritics, collapse whitespace,
// drop generic FMCG words that don't help disambiguate.
const STOP_WORDS = /\b(supermarket|hypermarket|hyper|super|market|mart|store|shop|grocery|trading|company|co|llc|center|trade|enterprise|بقالة|بقاله|بقال|تموينات|تموين|سوبر|ماركت|ميني|متجر|مركز|محل|مؤسسة|شركة)\b/gi;
const normalizeName = (s?: string): string => {
    if (!s) return '';
    return s
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[ً-ْ]/g, '')                      // Arabic diacritics
        .replace(STOP_WORDS, ' ')
        .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

// Returns true if two normalized names look like the same business
const namesMatch = (a?: string, b?: string): boolean => {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (!na || !nb || na.length < 2 || nb.length < 2) return false;
    if (na === nb) return true;
    // Substring match either direction (catches "Tamimi" vs "Tamimi Markets")
    if (na.length >= 4 && nb.includes(na)) return true;
    if (nb.length >= 4 && na.includes(nb)) return true;
    return false;
};

// ─── Lead Categories ────────────────────────────────────────────
type Channel = 'modern_trade' | 'traditional_trade' | 'horeca' | 'healthcare' | 'other';

interface LeadCategory {
    id: string;
    label: string;
    labelAr: string;
    icon: React.ElementType;
    color: string;        // Tailwind text-color
    hex: string;          // map marker hex
    overpass: string;     // Overpass QL fragment (without bbox)
    channel: Channel;     // FMCG channel grouping
}

const CHANNEL_META: Record<Channel, { label: string; labelAr: string; color: string; icon: React.ElementType }> = {
    modern_trade:      { label: 'Modern Trade',      labelAr: 'التجارة الحديثة',      color: 'text-emerald-300', icon: Store       },
    traditional_trade: { label: 'Traditional Trade', labelAr: 'التجارة التقليدية',    color: 'text-orange-300',  icon: ShoppingBag },
    horeca:            { label: 'HoReCa',            labelAr: 'فندقة ومطاعم',         color: 'text-pink-300',    icon: Coffee      },
    healthcare:        { label: 'Healthcare',        labelAr: 'الصحة',                color: 'text-sky-300',     icon: Stethoscope },
    other:             { label: 'Other',             labelAr: 'أخرى',                 color: 'text-slate-300',   icon: Layers      },
};

// FMCG-focused taxonomy: every category targets a real distribution channel
// Retail is the wide net — anything that resembles a small grocery, kiosk, bakala, or general store.
const LEAD_CATEGORIES: LeadCategory[] = [
    // ── TRADITIONAL TRADE / FMCG CATCH-ALL ──
    { id: 'retail', label: 'Retail / FMCG', labelAr: 'تجزئة / بضائع استهلاكية', icon: ShoppingBag, color: 'text-orange-400', hex: '#f97316', channel: 'traditional_trade',
      overpass: [
          'nwr["shop"~"^(general|convenience|department_store|kiosk|variety_store|grocery|greengrocer|deli|frozen_food|seafood|dairy|spices|chocolate|water|coffee|tea|alcohol|beverages|wine|tobacco|e-cigarette|confectionery|ice_cream|nuts|pasta|farm|food)$"]',
          'nwr["name"~"bakala|baqala|baqalah|baqaala|baqqala|baqqalah|tamwinat|tamouinat|tamooinat|tamween|grocery|grocer|mart|supermart|mini.?mart|tamwein|بقاله|بقالة|بقال|بقالات|تموينات|تموينة|تموين|سوبر.?ماركت|ميني.?ماركت|ماركت",i]',
          'nwr["name:en"~"bakala|baqala|baqalah|baqqala|tamwinat|tamween|grocery|grocer|food.?mart|food.?store|mini.?market|super.?market",i]',
          'nwr["name:ar"~"بقاله|بقالة|بقال|بقالات|تموينات|تموينة|تموين|ماركت|سوبر.?ماركت|ميني.?ماركت"]',
      ].join(';')
    },
    { id: 'grocery',      label: 'Grocery',         labelAr: 'بقالة',             icon: ShoppingCart, color: 'text-amber-400',   hex: '#f59e0b', channel: 'traditional_trade', overpass: 'nwr["shop"~"^(grocery|greengrocer|deli|farm|food)$"];nwr["name"~"bakala|baqala|baqalah|بقاله|بقالة|بقال",i]' },
    { id: 'supermarket',  label: 'Supermarket',     labelAr: 'سوبرماركت',         icon: Store,        color: 'text-yellow-400',  hex: '#eab308', channel: 'modern_trade',      overpass: 'nwr["shop"="supermarket"]' },
    { id: 'minimarket',   label: 'Mini Market',     labelAr: 'محل تموين',         icon: Store,        color: 'text-lime-400',    hex: '#84cc16', channel: 'modern_trade',      overpass: 'nwr["shop"="convenience"]' },
    { id: 'hypermarket',  label: 'Hypermarket',     labelAr: 'هايبرماركت',        icon: Store,        color: 'text-emerald-400', hex: '#10b981', channel: 'modern_trade',      overpass: 'nwr["shop"~"^(supermarket|mall)$"]["name"~"hyper|هايبر",i]' },

    { id: 'bakery',       label: 'Bakery',          labelAr: 'مخبز',              icon: Cake,         color: 'text-pink-400',    hex: '#ec4899', channel: 'horeca', overpass: 'nwr["shop"="bakery"];nwr["craft"="bakery"];nwr["name"~"bakery|مخبز|مخابز|فرن|أفران|forn",i]' },
    { id: 'butcher',      label: 'Butcher',         labelAr: 'جزارة',             icon: Beef,         color: 'text-red-500',     hex: '#dc2626', channel: 'horeca', overpass: 'nwr["shop"="butcher"];nwr["name"~"butcher|ملحمة|ملاحم|جزارة|lahman|laham",i]' },
    { id: 'confectionery',label: 'Sweets',          labelAr: 'حلويات',            icon: Cookie,       color: 'text-rose-300',    hex: '#fda4af', channel: 'horeca', overpass: 'nwr["shop"~"^(confectionery|chocolate|pastry|ice_cream)$"];nwr["name"~"sweets|halawiyat|halawayat|حلويات|حلوانى|حلواني|آيس.?كريم|ice.?cream",i]' },
    { id: 'cafe',         label: 'Cafe',            labelAr: 'كافيه / قهوة',      icon: Coffee,       color: 'text-amber-300',   hex: '#fcd34d', channel: 'horeca', overpass: 'nwr["amenity"="cafe"];nwr["shop"~"^(coffee|tea)$"];nwr["name"~"cafe|coffee|قهوة|مقهى|مقاهي",i]' },
    { id: 'restaurant',   label: 'Restaurant',      labelAr: 'مطعم',              icon: ChefHat,      color: 'text-indigo-300',  hex: '#a5b4fc', channel: 'horeca', overpass: 'nwr["amenity"~"^(restaurant|fast_food|food_court)$"]' },
    { id: 'beverages',    label: 'Beverages',       labelAr: 'مشروبات',           icon: CupSoda,      color: 'text-cyan-300',    hex: '#67e8f9', channel: 'horeca', overpass: 'nwr["shop"~"^(beverages|alcohol|water|tea|coffee)$"];nwr["name"~"juice|عصير|عصائر|مشروبات|drinks|beverages",i]' },

    { id: 'pharmacy',     label: 'Pharmacy',        labelAr: 'صيدلية',            icon: Pill,         color: 'text-teal-400',    hex: '#14b8a6', channel: 'healthcare', overpass: 'nwr["amenity"="pharmacy"];nwr["name"~"pharmacy|صيدلية|صيدليات",i]' },
    { id: 'pet_shop',     label: 'Pet Shops',       labelAr: 'محل حيوانات',       icon: PawPrint,     color: 'text-purple-400',  hex: '#a855f7', channel: 'other',      overpass: 'nwr["shop"~"^(pet|fodder)$"]' },
    { id: 'clinic',       label: 'Clinics',         labelAr: 'عيادة / مستشفى',   icon: Stethoscope,  color: 'text-sky-400',     hex: '#0ea5e9', channel: 'healthcare', overpass: 'nwr["amenity"="clinic"]' },
    { id: 'pet_clinic',   label: 'Pet Clinics',     labelAr: 'عيادة بيطرية',      icon: Stethoscope,  color: 'text-fuchsia-400', hex: '#d946ef', channel: 'healthcare', overpass: 'nwr["amenity"="veterinary"];nwr["healthcare"="veterinary"]' },
    { id: 'petrol',       label: 'Petrol Stations', labelAr: 'محطة وقود',         icon: Fuel,         color: 'text-rose-400',    hex: '#f43f5e', channel: 'other',      overpass: 'nwr["amenity"="fuel"]' },
    { id: 'hospital',     label: 'Hospitals',       labelAr: 'مستشفيات',          icon: Hospital,     color: 'text-red-400',     hex: '#ef4444', channel: 'healthcare', overpass: 'nwr["amenity"="hospital"]' },
];

const CATEGORY_BY_ID = Object.fromEntries(LEAD_CATEGORIES.map(c => [c.id, c]));

// ─── Marker icons ──────────────────────────────────────────────
const buildLeadIcon = (cat: LeadCategory, isDuplicate: boolean) => {
    const stroke = isDuplicate ? '#ef4444' : cat.hex;
    const fill   = isDuplicate ? 'rgba(239,68,68,0.25)' : `${cat.hex}40`;
    const ring   = isDuplicate ? 'animation: ms-pulse 1.6s ease-out infinite;' : '';
    return L.divIcon({
        className: 'ms-lead-icon',
        html: `
            <div style="position:relative;width:30px;height:30px;${ring}">
                <div style="position:absolute;inset:2px;border-radius:50%;background:${fill};border:2px solid ${stroke};box-shadow:0 0 12px ${stroke}80,inset 0 0 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
                    <div style="width:8px;height:8px;border-radius:50%;background:${stroke};box-shadow:0 0 6px ${stroke};"></div>
                </div>
                ${isDuplicate ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #0a0a14;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:900;">!</div>` : ''}
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
};

interface MarketScannerV2Props {
    existingCustomers: Customer[];
    onBack: () => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    isAiTheme?: boolean;
    settings?: CompanySettings;
    hideHeader?: boolean;
    maxScannerCap?: number;
    companyId?: string;
    userRole?: string;
    userBranchIds?: string[];
}

interface Lead {
    id: string;
    lat: number;
    lng: number;
    name: string;
    nameAr?: string;
    osmType: string;
    address: string;
    phone: string;
    categoryId: string;
    isDuplicate: boolean;          // within 10m of an existing customer
    nearestCustomerDistKm?: number;
    nearestCustomerName?: string;
    // ── AI fields ──
    qualityScore: number;          // 0-100; higher = richer + closer to existing route + good channel
    suggestedRoute?: string;       // route name from nearest existing customer
    suggestedDay?: string;          // day from nearest customer (for visit planning)
    aiTags: string[];              // human-readable insight tags ("Phone listed", "Near existing route", etc.)
}

const MarketScannerV2: React.FC<MarketScannerV2Props> = ({
    existingCustomers, onBack, language, settings, hideHeader = false, maxScannerCap,
    companyId, userRole, userBranchIds
}) => {
    const isAr = language === 'ar';
    const isAdmin = userRole === UserRole.ADMIN || userRole === 'ADMIN';
    const marketSettings = useMemo(() => ({ ...DEFAULT_COMPANY_SETTINGS.modules.market, ...settings?.modules?.market }), [settings]);

    // ── State ────────────────────────────────────────────
    const [dbBranches, setDbBranches] = useState<NormalizedBranch[]>([]);
    const [selectedBranches, setSelectedBranches] = useState<string[]>(['All']);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [showCustomers, setShowCustomers] = useState(true);
    const [hideDuplicates, setHideDuplicates] = useState(false); // legacy — duplicates now always excluded
    const [lastScanExcluded, setLastScanExcluded] = useState(0);
    const [branchOpen, setBranchOpen] = useState(false);
    const [userPos, setUserPos] = useState<L.LatLng | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [fetchedCustomers, setFetchedCustomers] = useState<Customer[] | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [filterApplied, setFilterApplied] = useState(false);
    const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
    const [collapsedChannels, setCollapsedChannels] = useState<Set<Channel>>(new Set(['horeca', 'healthcare', 'other']));
    const [legendOpen, setLegendOpen] = useState(false);

    const mapRef = useRef<L.Map | null>(null);
    const branchRef = useRef<HTMLDivElement>(null);
    const branchBtnRef = useRef<HTMLButtonElement>(null);
    const [branchMenuPos, setBranchMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (branchRef.current && branchRef.current.contains(target)) return;
            // Click inside the portal-rendered menu shouldn't close
            const menu = document.getElementById('msv2-branch-menu');
            if (menu && menu.contains(target)) return;
            setBranchOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    // Recompute portal position whenever the dropdown opens or window resizes/scrolls
    useEffect(() => {
        if (!branchOpen) return;
        const update = () => {
            if (!branchBtnRef.current) return;
            const r = branchBtnRef.current.getBoundingClientRect();
            setBranchMenuPos({ left: r.left, top: r.bottom + 4, width: r.width });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [branchOpen]);

    // ── Fetch real branches from DB (same source as RouteSequenceV2) ─
    useEffect(() => {
        if (!companyId) return;
        let cancelled = false;
        (async () => {
            try {
                let branches = await getBranches(companyId);
                if (!isAdmin && userBranchIds && userBranchIds.length > 0) {
                    branches = branches.filter(b =>
                        userBranchIds.includes(b.name_en) ||
                        userBranchIds.includes(b.id) ||
                        userBranchIds.includes(b.code)
                    );
                }
                if (!cancelled) setDbBranches(branches);
            } catch (e) {
                console.error('[MarketScannerV2] getBranches failed', e);
            }
        })();
        return () => { cancelled = true; };
    }, [companyId, isAdmin, userBranchIds]);

    // ── Branch options for the dropdown (from DB; falls back to customer regions if DB empty) ─
    const availableBranches = useMemo(() => {
        if (dbBranches.length > 0) {
            return dbBranches.map(b => b.name_en).sort();
        }
        // Fallback: derive from customer data using any populated field
        const set = new Set<string>();
        existingCustomers.forEach(c => {
            const v = c.regionDescription || c.regionCode || c.branch;
            if (v) set.add(v);
        });
        return Array.from(set).sort();
    }, [dbBranches, existingCustomers]);

    // ── Match a customer to a branch by trying all reasonable mappings ─
    const customerMatchesBranch = (c: Customer, branchName: string) => {
        const candidates = [c.regionDescription, c.regionCode, c.branch].filter(Boolean) as string[];
        if (candidates.includes(branchName)) return true;
        // Cross-check by branch code/id (when customer.regionCode = branch.code)
        const matchedBranch = dbBranches.find(b => b.name_en === branchName);
        if (matchedBranch) {
            return candidates.some(v => v === matchedBranch.code || v === matchedBranch.id);
        }
        return false;
    };

    // ── Customers in scope ───────────────────────────────
    // Priority: server-fetched data (after Apply Filter) > prop-based filter (fallback)
    // Always deduped by clientCode → id → lat,lng — same customer can appear on many route_visits
    const scopedCustomers = useMemo(() => {
        const dedupe = (list: Customer[]): Customer[] => {
            const seen = new Map<string, Customer>();
            for (const c of list) {
                if (!c.lat || !c.lng || isNaN(c.lat) || isNaN(c.lng)) continue;
                const key = (c.clientCode && c.clientCode.trim())
                    || c.id
                    || `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
                if (!seen.has(key)) seen.set(key, c);
            }
            return Array.from(seen.values());
        };

        if (fetchedCustomers !== null) {
            return dedupe(fetchedCustomers);
        }
        const isAll = selectedBranches.includes('All') || selectedBranches.length === 0;
        const filtered = isAll ? existingCustomers : existingCustomers.filter(c => selectedBranches.some(b => customerMatchesBranch(c, b)));
        return dedupe(filtered);
    }, [fetchedCustomers, existingCustomers, selectedBranches, dbBranches]);

    // Reset the "applied" flag whenever branch selection changes — user must re-apply
    useEffect(() => {
        setFilterApplied(false);
    }, [selectedBranches]);

    // ── Apply Filter — fetch ALL customers for the branch directly from normalized_customers ─
    // Uses the same source as the Customers screen (no route_visits dependency, so customers
    // without any route assignment still appear). Paginated to handle >1000 rows.
    const handleApplyFilter = async () => {
        if (!companyId) {
            setScanError('Cannot fetch customers: company context missing.');
            return;
        }
        setIsFetching(true);
        setScanError(null);
        try {
            // Resolve branch IDs from selected branch names
            const isAll = selectedBranches.includes('All') || selectedBranches.length === 0;
            const targetBranchIds = isAll
                ? null
                : dbBranches.filter(b => selectedBranches.includes(b.name_en)).map(b => b.id);

            if (!isAll && (!targetBranchIds || targetBranchIds.length === 0)) {
                setScanError('Could not resolve branch IDs. Try refreshing the page.');
                setIsFetching(false);
                return;
            }

            // Paginate through normalized_customers in 1000-row chunks
            const PAGE = 1000;
            const all: any[] = [];
            let from = 0;
            // Bounded loop: max 50 pages = 50,000 customers
            for (let i = 0; i < 50; i++) {
                let q = supabase
                    .from('normalized_customers')
                    .select(`
                        *,
                        branches:company_branches!branch_id(id, code, name_en, name_ar),
                        visits:route_visits(week_number, day_name, routes:route_id(name))
                    `)
                    .eq('company_id', companyId)
                    .eq('is_active', true)
                    .range(from, from + PAGE - 1);

                if (targetBranchIds) q = q.in('branch_id', targetBranchIds);

                const { data, error } = await q;
                if (error) throw error;
                if (!data || data.length === 0) break;
                all.push(...data);
                if (data.length < PAGE) break;
                from += PAGE;
            }

            // Map normalized rows → Customer interface (same shape as fetchCustomers)
            const customers: Customer[] = all.map((row: any) => {
                const visits = row.visits || [];
                const routes = Array.from(new Set(visits.map((v: any) => v.routes?.name).filter(Boolean))).join(', ');
                const days   = Array.from(new Set(visits.map((v: any) => v.day_name).filter(Boolean))).join(', ');
                const weeks  = Array.from(new Set(visits.map((v: any) => v.week_number).filter(Boolean))).join(', ');
                return {
                    id: row.id,
                    name: row.name_en,
                    nameAr: row.name_ar,
                    clientCode: row.client_code,
                    reachCustomerCode: row.reach_customer_code,
                    lat: Number(row.lat) || 0,
                    lng: Number(row.lng) || 0,
                    address: row.address,
                    phone: row.phone,
                    classification: row.classification,
                    vat: row.vat,
                    buyerId: row.buyer_id,
                    storeType: row.store_type,
                    district: row.district,
                    data: row.dynamic_data,
                    regionDescription: row.branches?.name_en || 'Unassigned',
                    regionCode: row.branches?.code || '',
                    branch: row.branches?.name_en,
                    routeName: routes || '',
                    week: weeks,
                    day: days,
                    addedDate: row.created_at,
                } as Customer;
            });

            setFetchedCustomers(customers);
            setFilterApplied(true);
            if (customers.length === 0) {
                setScanError(isAll
                    ? 'No customers found for this company. Upload customer data first.'
                    : `No customers found for ${selectedBranches.length === 1 ? `branch "${selectedBranches[0]}"` : `the ${selectedBranches.length} selected branches`}.`);
            }
        } catch (e: any) {
            console.error('[MarketScannerV2] fetch customers failed', e);
            setScanError(e?.message || 'Failed to load customers from server.');
        } finally {
            setIsFetching(false);
        }
    };

    // ── Filtered leads (apply duplicate filter) — sorted by AI quality score desc ─
    const visibleLeads = useMemo(() => {
        const filtered = hideDuplicates ? leads.filter(l => !l.isDuplicate) : leads;
        return [...filtered].sort((a, b) => b.qualityScore - a.qualityScore);
    }, [leads, hideDuplicates]);

    // ── Stats ────────────────────────────────────────────
    const duplicateCount = useMemo(() => leads.filter(l => l.isDuplicate).length, [leads]);
    const newLeadCount   = leads.length - duplicateCount;

    // ── AI Insights: channel mix, avg quality, top suggested route ─
    const aiInsights = useMemo(() => {
        if (leads.length === 0) return null;
        const newLeads = leads.filter(l => !l.isDuplicate);
        if (newLeads.length === 0) return null;

        const byChannel = new Map<Channel, number>();
        for (const l of newLeads) {
            const cat = CATEGORY_BY_ID[l.categoryId];
            if (cat) byChannel.set(cat.channel, (byChannel.get(cat.channel) || 0) + 1);
        }
        const topChannel = Array.from(byChannel.entries()).sort((a, b) => b[1] - a[1])[0];

        const avgQuality = Math.round(newLeads.reduce((s, l) => s + l.qualityScore, 0) / newLeads.length);

        const routeFreq = new Map<string, number>();
        for (const l of newLeads) {
            if (l.suggestedRoute) routeFreq.set(l.suggestedRoute, (routeFreq.get(l.suggestedRoute) || 0) + 1);
        }
        const topRoute = Array.from(routeFreq.entries()).sort((a, b) => b[1] - a[1])[0];

        const closeToRoute = newLeads.filter(l => l.nearestCustomerDistKm !== undefined && l.nearestCustomerDistKm < 1).length;
        const newTerritory = newLeads.filter(l => l.nearestCustomerDistKm !== undefined && l.nearestCustomerDistKm >= 3).length;

        return { byChannel, topChannel, avgQuality, topRoute, closeToRoute, newTerritory, newLeadsTotal: newLeads.length };
    }, [leads]);

    // ── Route → color palette (deterministic, distinguishable) ──
    const ROUTE_PALETTE = [
        '#22d3ee', '#a78bfa', '#fb7185', '#fbbf24', '#34d399',
        '#60a5fa', '#f472b6', '#fde047', '#4ade80', '#c084fc',
        '#fb923c', '#2dd4bf', '#f87171', '#818cf8', '#a3e635',
        '#e879f9', '#facc15', '#38bdf8', '#fda4af', '#86efac'
    ];

    const routeColorMap = useMemo(() => {
        const map = new Map<string, string>();
        const sortedRoutes = Array.from(new Set(
            scopedCustomers.map(c => c.routeName || 'UNASSIGNED')
        )).sort();
        sortedRoutes.forEach((route, i) => map.set(route, ROUTE_PALETTE[i % ROUTE_PALETTE.length]));
        return map;
    }, [scopedCustomers]);

    const totalRoutesInScope = routeColorMap.size;

    // ── Auto-fit map to scoped customers (re-runs on branch change) ──
    useEffect(() => {
        if (!mapRef.current || scopedCustomers.length === 0) return;
        const bounds = L.latLngBounds(scopedCustomers.map(c => [c.lat, c.lng] as [number, number]));
        if (bounds.isValid()) {
            // Delay slightly so layout/leaflet settle, especially after dropdown closes
            const t = setTimeout(() => {
                mapRef.current?.fitBounds(bounds.pad(0.15), { animate: true, duration: 0.6, maxZoom: 14 });
            }, 80);
            return () => clearTimeout(t);
        }
    }, [scopedCustomers]);

    // ── Handlers ─────────────────────────────────────────
    const toggleBranch = (b: string) => {
        if (b === 'All') { setSelectedBranches(['All']); return; }
        const noAll = selectedBranches.filter(x => x !== 'All');
        const next = noAll.includes(b) ? noAll.filter(x => x !== b) : [...noAll, b];
        setSelectedBranches(next.length ? next : ['All']);
    };

    const toggleCategory = (id: string) => {
        setSelectedCategories(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };

    const handleScan = async () => {
        if (!mapRef.current) return;
        if (selectedCategories.length === 0) { setScanError('Pick at least one lead type to scan.'); return; }
        if (mapRef.current.getZoom() < marketSettings.minZoomLevel) {
            setScanError(`Zoom in (level ${marketSettings.minZoomLevel}+) before scanning.`);
            return;
        }
        if (maxScannerCap && leads.length >= maxScannerCap) {
            setScanError(`Plan limit: max ${maxScannerCap} leads per scan. Clear leads to continue.`);
            return;
        }

        setScanError(null);
        setIsScanning(true);

        const bounds = mapRef.current.getBounds();
        const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

        const fragments = selectedCategories
            .map(id => CATEGORY_BY_ID[id])
            .filter(Boolean)
            .map(c => c.overpass.split(';').filter(Boolean).map(part => `${part}(${bbox});`).join(''))
            .join('');

        const query = `[out:json][timeout:${marketSettings.searchTimeoutSeconds}];(${fragments});out center;`;

        const fetchWithFailover = async (retry = 0): Promise<any> => {
            const endpoint = OVERPASS_MIRRORS[retry % OVERPASS_MIRRORS.length];
            try {
                const r = await fetch(endpoint, { method: 'POST', body: query });
                if (r.status === 429) throw new Error('Rate limited. Wait ~15s and retry.');
                if (!r.ok) throw new Error(`Overpass mirror error (${r.status}).`);
                return await r.json();
            } catch (e: any) {
                if (retry < 2) return fetchWithFailover(retry + 1);
                throw e;
            }
        };

        try {
            const data = await fetchWithFailover();
            const elements = data?.elements || [];
            const localCustomers = scopedCustomers.filter(c => bounds.contains([c.lat, c.lng]));

            const remainingCap = maxScannerCap ? (maxScannerCap - leads.length) : Infinity;
            const fresh: Lead[] = [];
            const seen = new Set<string>();
            let excludedCount = 0;       // leads skipped because they match an existing customer (geo or name)

            for (const el of elements) {
                const lat = el.lat ?? el.center?.lat;
                const lng = el.lon ?? el.center?.lon;
                if (lat == null || lng == null) continue;
                const idKey = `${el.type}-${el.id}`;
                if (seen.has(idKey)) continue;
                seen.add(idKey);

                const tags = el.tags || {};
                const nameEn = tags['name:en'] || tags.name || 'Unnamed';
                const nameAr = tags['name:ar'] || '';
                const osmType = (tags.shop || tags.amenity || tags.healthcare || 'unit').toString().replace(/_/g, ' ');
                const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '—';
                const address = tags['addr:street'] || tags['addr:full'] || tags['addr:place'] || '—';

                // Determine candidate categories this element COULD fit into,
                // ordered by specificity (most specific first). Pick the first one
                // the user has actually selected — so if they selected only "Retail",
                // a grocery-tagged result is still kept (under Retail).
                const lower = String(nameEn + ' ' + nameAr).toLowerCase();
                const tagShop = tags.shop;
                const tagAmenity = tags.amenity;
                const tagHealth = tags.healthcare;
                const tagCraft = tags.craft;

                const candidates: string[] = [];
                // Healthcare specifics first (most distinct)
                if (tagAmenity === 'pharmacy') candidates.push('pharmacy');
                if (tagAmenity === 'hospital') candidates.push('hospital');
                if (tagAmenity === 'clinic') candidates.push('clinic');
                if (tagAmenity === 'veterinary' || tagHealth === 'veterinary') candidates.push('pet_clinic');
                if (tagAmenity === 'fuel') candidates.push('petrol');
                if (tagShop === 'pet' || tagShop === 'fodder') candidates.push('pet_shop');

                // HoReCa
                if (tagAmenity === 'cafe' || tagShop === 'coffee' || tagShop === 'tea' || /cafe|coffee|قهوة|مقهى|مقاهي/i.test(lower)) candidates.push('cafe');
                if (tagAmenity === 'restaurant' || tagAmenity === 'fast_food' || tagAmenity === 'food_court') candidates.push('restaurant');
                if (tagShop === 'bakery' || tagCraft === 'bakery' || /bakery|مخبز|مخابز|فرن|forn/i.test(lower)) candidates.push('bakery');
                if (tagShop === 'butcher' || /butcher|ملحمة|ملاحم|جزارة|laham/i.test(lower)) candidates.push('butcher');
                if (['confectionery','chocolate','pastry','ice_cream'].includes(tagShop) || /sweets|halawiyat|halawayat|حلويات|حلواني|ice.?cream/i.test(lower)) candidates.push('confectionery');
                if (['beverages','alcohol','water','tea','coffee'].includes(tagShop) || /juice|عصير|عصائر|مشروبات|drinks|beverages/i.test(lower)) candidates.push('beverages');

                // Modern / traditional trade
                if (tagShop === 'supermarket' && /hyper|هايبر/i.test(lower)) candidates.push('hypermarket');
                if (tagShop === 'mall' && /hyper|هايبر/i.test(lower)) candidates.push('hypermarket');
                if (tagShop === 'supermarket') candidates.push('supermarket');
                if (tagShop === 'convenience') candidates.push('minimarket');
                if (['grocery','greengrocer','deli','farm','food'].includes(tagShop)) candidates.push('grocery');

                // Retail = catch-all FMCG; almost everything from a shop tag falls here too
                if (tagShop || /bakala|baqala|baqalah|baqaala|tamwinat|tamween|بقاله|بقالة|بقال|تموينات|تموين|grocery|grocer|mart/i.test(lower)) candidates.push('retail');

                // Pick the first candidate that's in selectedCategories
                const categoryId = candidates.find(c => selectedCategories.includes(c));
                if (!categoryId) continue;

                // ── Duplicate detection — exclude entirely if matches an existing customer ──
                // Rule 1: geographic — within DUPLICATE_THRESHOLD_KM (20m) of any customer
                // Rule 2: name validation — within NAME_MATCH_RADIUS_KM (100m) AND names match
                //   (catches GPS drift where the same store is tagged at slightly different coords)
                let nearestKm = Infinity;
                let nearestCustomer: Customer | undefined;
                let nameMatchedCustomer: Customer | undefined;
                let nameMatchDistKm = Infinity;

                for (const c of localCustomers) {
                    const d = calculateDistance(lat, lng, c.lat, c.lng);
                    if (d < nearestKm) { nearestKm = d; nearestCustomer = c; }
                    // Name validation only matters if within the wider radius
                    if (d <= NAME_MATCH_RADIUS_KM) {
                        if (namesMatch(nameEn, c.name) || namesMatch(nameAr, c.nameAr) ||
                            namesMatch(nameEn, c.nameAr) || namesMatch(nameAr, c.name)) {
                            if (d < nameMatchDistKm) { nameMatchDistKm = d; nameMatchedCustomer = c; }
                        }
                    }
                }

                const isGeoDup  = nearestKm <= DUPLICATE_THRESHOLD_KM;
                const isNameDup = !!nameMatchedCustomer;

                // Skip the lead entirely — DO NOT add to results
                if (isGeoDup || isNameDup) {
                    excludedCount++;
                    continue;
                }

                // ── AI: Quality score (0-100) ──────────────────────────
                let score = 0;
                const aiTags: string[] = [];

                // Metadata richness (max 35 pts)
                if (phone && phone !== '—') { score += 18; aiTags.push('Phone listed'); }
                if (address && address !== '—') { score += 12; aiTags.push('Has address'); }
                if (nameAr && nameAr.length > 0) { score += 5; aiTags.push('Bilingual'); }

                // Channel value (max 25 pts)
                const cat = CATEGORY_BY_ID[categoryId];
                const channelScores: Record<Channel, number> = {
                    modern_trade: 25, traditional_trade: 22, horeca: 18, healthcare: 14, other: 10
                };
                if (cat) score += channelScores[cat.channel];

                // Route-fit (max 30 pts)
                if (isFinite(nearestKm)) {
                    if (nearestKm < 0.5) { score += 30; aiTags.push('In existing route radius'); }
                    else if (nearestKm < 1)   { score += 22; aiTags.push('Close to route'); }
                    else if (nearestKm < 3)   { score += 14; aiTags.push('Moderate distance'); }
                    else if (nearestKm < 6)   { score += 6;  aiTags.push('New territory'); }
                    else                       { aiTags.push('Far from existing routes'); }
                }

                // Bonus
                if (nameEn && nameEn.length > 4 && nameEn !== 'Unnamed') { score += 8; }
                if (cat && cat.channel === 'modern_trade') aiTags.push('High-value channel');

                fresh.push({
                    id: idKey,
                    lat, lng,
                    name: nameEn,
                    nameAr,
                    osmType: osmType.toUpperCase(),
                    address,
                    phone,
                    categoryId,
                    isDuplicate: false,
                    nearestCustomerDistKm: isFinite(nearestKm) ? nearestKm : undefined,
                    nearestCustomerName: nearestCustomer?.name,
                    qualityScore: Math.min(100, Math.round(score)),
                    suggestedRoute: nearestCustomer?.routeName,
                    suggestedDay: nearestCustomer?.day,
                    aiTags,
                });
            }

            const truncated = fresh.slice(0, Math.max(0, remainingCap));
            // De-dupe against already-scanned leads by id
            let addedCount = 0;
            setLeads(prev => {
                const existingIds = new Set(prev.map(l => l.id));
                const newOnes = truncated.filter(l => !existingIds.has(l.id));
                addedCount = newOnes.length;
                return [...prev, ...newOnes];
            });

            // Track excluded count for the UI banner
            setLastScanExcluded(excludedCount);

            if (fresh.length > truncated.length) {
                setScanError(`Plan limit reached — ${fresh.length - truncated.length} additional results were dropped.${excludedCount ? ` ${excludedCount} matched existing customers and were excluded.` : ''}`);
            } else if (fresh.length === 0 && excludedCount === 0) {
                setScanError(`No leads found in this area for the selected types. Try zooming out a bit, picking different lead types, or panning the map.`);
            } else if (fresh.length === 0 && excludedCount > 0) {
                setScanError(`All ${excludedCount} match${excludedCount === 1 ? '' : 'es'} in this area are already your customers (within 20m or matching name within 100m). Try a different area.`);
            } else if (addedCount === 0) {
                setScanError(`Found ${fresh.length} matches — all already in your lead list. Pan or zoom to a new area.`);
            }
        } catch (e: any) {
            setScanError(e?.message || 'Scan failed. Try a smaller area.');
        } finally {
            setIsScanning(false);
        }
    };

    const clearLeads = () => { setLeads([]); setScanError(null); setLastScanExcluded(0); };

    const toggleSelectLead = (lead: Lead) => {
        setSelectedLeads(prev =>
            prev.some(l => l.id === lead.id)
                ? prev.filter(l => l.id !== lead.id)
                : [...prev, lead]
        );
    };

    const handleExport = () => {
        if (leads.length === 0) return;
        const headers = ['Name', 'Arabic Name', 'Category', 'Channel', 'OSM Type', 'Phone', 'Address', 'Lat', 'Lng', 'Status', 'Quality Score', 'Suggested Route', 'Suggested Day', 'Nearest Customer', 'Distance to Customer (km)', 'AI Tags'];
        const rows = visibleLeads.map(l => {
            const cat = CATEGORY_BY_ID[l.categoryId];
            return [
                `"${l.name.replace(/"/g, '""')}"`,
                `"${(l.nameAr || '').replace(/"/g, '""')}"`,
                cat?.label || l.categoryId,
                cat ? CHANNEL_META[cat.channel].label : '',
                l.osmType,
                `"${l.phone}"`,
                `"${l.address.replace(/"/g, '""')}"`,
                l.lat,
                l.lng,
                l.isDuplicate ? 'EXISTING_CUSTOMER' : 'NEW_LEAD',
                l.qualityScore,
                `"${(l.suggestedRoute || '').replace(/"/g, '""')}"`,
                `"${(l.suggestedDay || '').replace(/"/g, '""')}"`,
                `"${(l.nearestCustomerName || '').replace(/"/g, '""')}"`,
                l.nearestCustomerDistKm?.toFixed(4) || '',
                `"${(l.aiTags || []).join('; ')}"`,
            ];
        });
        const csv = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `MarketScannerV2_AllLeads_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const handleExportSelected = () => {
        if (selectedLeads.length === 0) return;
        const headers = ['Name', 'Arabic Name', 'Category', 'Channel', 'OSM Type', 'Phone', 'Address', 'Lat', 'Lng', 'Quality Score', 'Suggested Route', 'Suggested Day', 'Nearest Customer', 'Distance to Customer (km)', 'AI Tags'];
        const rows = selectedLeads.map(l => {
            const cat = CATEGORY_BY_ID[l.categoryId];
            return [
                `"${l.name.replace(/"/g, '""')}"`,
                `"${(l.nameAr || '').replace(/"/g, '""')}"`,
                cat?.label || l.categoryId,
                cat ? CHANNEL_META[cat.channel].label : '',
                l.osmType,
                `"${l.phone}"`,
                `"${l.address.replace(/"/g, '""')}"`,
                l.lat,
                l.lng,
                l.qualityScore,
                `"${(l.suggestedRoute || '').replace(/"/g, '""')}"`,
                `"${(l.suggestedDay || '').replace(/"/g, '""')}"`,
                `"${(l.nearestCustomerName || '').replace(/"/g, '""')}"`,
                l.nearestCustomerDistKm?.toFixed(4) || '',
                `"${(l.aiTags || []).join('; ')}"`,
            ];
        });
        const csv = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `MyLeads_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    // ── Locate Me handler ────────────────────────────────
    const handleLocateMe = () => {
        if (!mapRef.current) return;
        setIsLocating(true);
        mapRef.current.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    };

    // ── Map handler (also handles geolocation events) ────
    const userIcon = useMemo(() => createUserLocationIcon(), []);
    const MapHandler = () => {
        const map = useMap();
        useEffect(() => {
            mapRef.current = map;
            const onFound = (e: L.LocationEvent) => {
                setUserPos(e.latlng);
                setIsLocating(false);
            };
            const onError = () => {
                setIsLocating(false);
                setScanError('Location unavailable. Please grant permission or try again.');
            };
            map.on('locationfound', onFound);
            map.on('locationerror', onError);
            return () => {
                map.off('locationfound', onFound);
                map.off('locationerror', onError);
            };
        }, [map]);
        return userPos ? <Marker position={userPos} icon={userIcon} zIndexOffset={3000} /> : null;
    };

    return (
        <div data-reach-screen className="relative h-screen w-full font-sans overflow-hidden text-white bg-[#020617]">
            {/* Inject pulse keyframes for duplicate markers */}
            <style>{`@keyframes ms-pulse { 0%{transform:scale(1);opacity:1} 50%{transform:scale(1.18);opacity:0.7} 100%{transform:scale(1);opacity:1} }`}</style>

            {/* Scanning overlay */}
            {isScanning && (
                <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center">
                    <div className="absolute inset-0 bg-cyan-950/30 backdrop-blur-[2px]" />
                    <div className="relative flex flex-col items-center">
                        <Radar className="w-32 h-32 animate-pulse text-cyan-400" />
                        <div className="mt-4 text-cyan-300 font-black text-xs uppercase tracking-widest animate-pulse">Scanning Market…</div>
                    </div>
                </div>
            )}

            {/* Map */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={[23.8859, 45.0792]} zoom={6}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false} preferCanvas={true}
                >
                    <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
                    <MapHandler />

                    {/* Existing customers — colored by route */}
                    {showCustomers && scopedCustomers.map((c, i) => {
                        const routeKey = c.routeName || 'UNASSIGNED';
                        const color = routeColorMap.get(routeKey) || '#22d3ee';
                        return (
                            <CircleMarker
                                key={`cust-${c.id || c.clientCode || i}`}
                                center={[c.lat, c.lng]}
                                radius={6}
                                pathOptions={{ fillColor: color, color: '#0a0a14', weight: 1.5, fillOpacity: 0.95, renderer: canvasRenderer }}
                            >
                                <Popup>
                                    <div className="p-3 w-[240px] bg-[#0f172a] text-white rounded-xl border" style={{ borderColor: `${color}80` }}>
                                        <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color }}>{isAr ? 'عميل حالي' : 'Existing Customer'}</div>
                                        <h4 className="text-sm font-black truncate">{c.name}</h4>
                                        {c.nameAr && <div className="text-xs text-indigo-300 mt-0.5" dir="rtl">{c.nameAr}</div>}
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                                            <div><span className="text-white/40">Code:</span> <span className="font-mono">{c.clientCode || '—'}</span></div>
                                            <div className="flex items-center gap-1"><span className="text-white/40">Route:</span> <span className="inline-flex items-center gap-1 font-bold" style={{ color }}>● {routeKey}</span></div>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}

                    {/* Leads */}
                    {visibleLeads.map(l => {
                        const cat = CATEGORY_BY_ID[l.categoryId] || LEAD_CATEGORIES[0];
                        return (
                            <Marker key={l.id} position={[l.lat, l.lng]} icon={buildLeadIcon(cat, l.isDuplicate)}>
                                <Popup>
                                    <div className="p-3 w-[260px] bg-[#0f172a] text-white rounded-xl border" style={{ borderColor: l.isDuplicate ? '#ef4444' : cat.hex }}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: l.isDuplicate ? '#fca5a5' : cat.hex }}>
                                                {l.isDuplicate ? (isAr ? '⚠ عميل موجود مسبقاً' : '⚠ Already a Customer') : (isAr ? cat.labelAr : cat.label)}
                                            </span>
                                            <cat.icon className="w-4 h-4" style={{ color: cat.hex }} />
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-sm font-black leading-tight flex-1">{l.name}</h4>
                                            {/* AI Quality badge */}
                                            <div
                                                className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                                                style={{
                                                    background: l.qualityScore >= 70 ? 'rgba(16,185,129,0.18)' : l.qualityScore >= 45 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)',
                                                    color: l.qualityScore >= 70 ? '#34d399' : l.qualityScore >= 45 ? '#fbbf24' : '#f87171',
                                                    border: '1px solid currentColor'
                                                }}
                                                title={isAr ? 'درجة الجودة (0-100)' : 'AI Quality Score (0-100)'}
                                            >
                                                Q {l.qualityScore}
                                            </div>
                                        </div>
                                        {l.nameAr && <div className="text-xs text-indigo-300 mt-0.5" dir="rtl">{l.nameAr}</div>}
                                        <div className="mt-2 space-y-1 text-[10px] text-white/70">
                                            <div className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span>{l.address}</span></div>
                                            <div className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" /><span className="font-mono">{l.phone}</span></div>
                                        </div>

                                        {/* AI tags */}
                                        {l.aiTags && l.aiTags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {l.aiTags.slice(0, 4).map((tag, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-white/5 border border-white/10 text-white/60 uppercase tracking-wider">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Suggested route — AI insight */}
                                        {l.suggestedRoute && !l.isDuplicate && (
                                            <div className="mt-2 px-2 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/25">
                                                <div className="flex items-center gap-1 text-[8px] font-black text-cyan-300 uppercase tracking-widest mb-0.5">
                                                    <Sparkles className="w-2.5 h-2.5" /> {isAr ? 'اقتراح الذكاء الاصطناعي' : 'AI Suggestion'}
                                                </div>
                                                <div className="text-[10px] text-white/80 leading-tight">
                                                    {isAr ? 'أضف إلى ' : 'Add to '}<strong className="text-cyan-300">{l.suggestedRoute}</strong>
                                                    {l.suggestedDay && <span className="text-white/50"> · {l.suggestedDay}</span>}
                                                </div>
                                                {l.nearestCustomerDistKm !== undefined && (
                                                    <div className="text-[9px] text-white/40 mt-0.5">
                                                        {(l.nearestCustomerDistKm * 1000).toFixed(0)}{isAr ? 'م من أقرب عميل' : 'm from nearest customer'}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {l.isDuplicate && (
                                            <div className="mt-2 px-2 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-[10px] text-red-300">
                                                {isAr ? 'ضمن 10م من ' : 'Within 10m of '}<strong>{l.nearestCustomerName}</strong>{isAr ? ' — موجود مسبقاً في قائمتك.' : ' — likely already in your portfolio.'}
                                            </div>
                                        )}
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-white text-[11px] font-black"
                                            style={{ backgroundColor: l.isDuplicate ? '#ef4444' : cat.hex }}
                                        >
                                            <Navigation className="w-3 h-3" /> {isAr ? 'التنقل' : 'Navigate'}
                                        </a>
                                        {!l.isDuplicate && (
                                            <button
                                                onClick={() => toggleSelectLead(l)}
                                                className="mt-1.5 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border text-[11px] font-black transition-all active:scale-95"
                                                style={selectedLeads.some(s => s.id === l.id)
                                                    ? { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#ef4444', color: '#fca5a5' }
                                                    : { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: '#34d399' }
                                                }
                                            >
                                                {selectedLeads.some(s => s.id === l.id)
                                                    ? <><X className="w-3 h-3" /> {isAr ? 'إزالة من القائمة' : 'Remove from List'}</>
                                                    : <><CheckCircle2 className="w-3 h-3" /> {isAr ? 'إضافة للقائمة' : 'Add to List'}</>
                                                }
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* ── Top-left: Header + Branch Filter ── */}
            <div className="absolute top-3 left-3 z-[20] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto pr-1">
                {!hideHeader && (
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="w-9 h-9 shrink-0 rounded-lg bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:bg-slate-800 flex items-center justify-center transition-all">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div data-reach-bar className="flex-1 rounded-lg bg-slate-900/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 flex items-center gap-2 shadow-2xl">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-md blur opacity-50" />
                                <div className="relative w-7 h-7 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 rounded-md flex items-center justify-center">
                                    <Radar className="w-4 h-4 text-white animate-pulse" />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-[11px] font-black uppercase tracking-widest leading-none">{isAr ? 'ماسح السوق' : 'Market Scanner'}</h2>
                                    <span className="px-1 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-[7px] font-black text-purple-300 uppercase tracking-widest">V2</span>
                                </div>
                                <p className="text-[8px] text-cyan-400 font-bold mt-0.5 uppercase truncate">{isAr ? 'استخبارات القنوات التجارية' : 'Trade Channel Intel'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Branch Filter */}
                <div className="rounded-lg bg-slate-900/85 backdrop-blur-xl border border-white/10 p-2 shadow-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-cyan-400" />
                            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{isAr ? 'الفرع' : 'Branch'}</span>
                        </div>
                        <button
                            onClick={() => setShowCustomers(v => !v)}
                            className="flex items-center gap-1 text-[9px] text-white/40 hover:text-cyan-300 transition-colors"
                            title={showCustomers ? (isAr ? 'إخفاء العملاء' : 'Hide customers') : (isAr ? 'عرض العملاء' : 'Show customers')}
                        >
                            {showCustomers ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="relative flex-1" ref={branchRef}>
                            <button
                                ref={branchBtnRef}
                                onClick={() => setBranchOpen(v => !v)}
                                className="w-full bg-white/5 border border-white/10 hover:border-cyan-500/40 rounded-md py-1.5 px-2 text-[11px] font-bold text-left flex items-center justify-between transition-all"
                            >
                                <span className="truncate">
                                    {selectedBranches.includes('All') || selectedBranches.length === 0
                                        ? `${isAr ? 'الكل' : 'All'}${availableBranches.length ? ` (${availableBranches.length})` : ''}`
                                        : `${selectedBranches.length} ${isAr ? 'محدد' : 'selected'}`}
                                </span>
                                <ChevronsUpDown className="w-3 h-3 text-white/40 shrink-0" />
                            </button>
                        </div>
                        <button
                            onClick={handleApplyFilter}
                            disabled={isFetching}
                            className={`shrink-0 h-7 px-2.5 rounded-md font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-95 ${
                                filterApplied
                                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white shadow-md shadow-cyan-500/30'
                            } ${isFetching ? 'opacity-60 cursor-wait' : ''}`}
                        >
                            {isFetching
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : filterApplied
                                    ? <><CheckCircle2 className="w-3 h-3" /> {isAr ? 'مُطبَّق' : 'Applied'}</>
                                    : <><Filter className="w-3 h-3" /> {isAr ? 'تطبيق' : 'Apply'}</>
                            }
                        </button>
                    </div>
                    {/* Portal-rendered dropdown — never clipped or covered */}
                    {branchOpen && branchMenuPos && createPortal(
                        <div
                            id="msv2-branch-menu"
                            style={{
                                position: 'fixed',
                                left: branchMenuPos.left,
                                top: branchMenuPos.top,
                                width: branchMenuPos.width,
                                zIndex: 999999,
                            }}
                            className="bg-slate-900/98 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl max-h-60 overflow-y-auto p-1 animate-in fade-in duration-100"
                        >
                            <div
                                onClick={() => toggleBranch('All')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${selectedBranches.includes('All') ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5'}`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedBranches.includes('All') ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>
                                    {selectedBranches.includes('All') && <Check className="w-3 h-3" />}
                                </div>
                                <span className="text-xs font-bold">{isAr ? 'جميع الفروع' : 'All Branches'}</span>
                            </div>
                            {availableBranches.length === 0 && (
                                <div className="px-3 py-3 text-[11px] text-white/40 text-center font-medium">
                                    {isAr ? 'لا توجد فروع' : 'No branches found.'}
                                </div>
                            )}
                            {availableBranches.map(b => {
                                const sel = selectedBranches.includes(b);
                                return (
                                    <div
                                        key={b}
                                        onClick={() => toggleBranch(b)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${sel ? 'bg-cyan-500/10 text-cyan-300' : 'hover:bg-white/5'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>
                                            {sel && <Check className="w-3 h-3" />}
                                        </div>
                                        <span className="text-xs font-medium truncate">{b}</span>
                                    </div>
                                );
                            })}
                        </div>,
                        document.body
                    )}

                    {filterApplied && fetchedCustomers !== null ? (
                        <div className="mt-1.5 grid grid-cols-3 gap-1">
                            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded p-1 text-center">
                                <div className="text-xs font-black text-cyan-300 leading-none">{fetchedCustomers.length}</div>
                                <div className="text-[7px] font-black text-cyan-400/60 uppercase tracking-wider mt-0.5">Fetched</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-1 text-center">
                                <div className="text-xs font-black text-emerald-300 leading-none">{scopedCustomers.length}</div>
                                <div className="text-[7px] font-black text-emerald-400/60 uppercase tracking-wider mt-0.5">Distinct</div>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded p-1 text-center">
                                <div className="text-xs font-black text-purple-300 leading-none">{totalRoutesInScope}</div>
                                <div className="text-[7px] font-black text-purple-400/60 uppercase tracking-wider mt-0.5">Routes</div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-1 text-[9px] text-white/40 text-center">{scopedCustomers.length} customers · {totalRoutesInScope} routes</div>
                    )}
                </div>

                {/* Lead Type Picker — grouped by FMCG channel, collapsible */}
                <div className="rounded-lg bg-slate-900/85 backdrop-blur-xl border border-white/10 p-2 shadow-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <ListChecks className="w-3 h-3 text-purple-400" />
                            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{isAr ? 'أنواع العملاء المحتملين' : 'Lead Types'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-white/40">{selectedCategories.length}/{LEAD_CATEGORIES.length}</span>
                            {selectedCategories.length > 0 && (
                                <button
                                    onClick={() => setSelectedCategories([])}
                                    className="text-[8px] font-bold text-white/40 hover:text-rose-400 px-1 py-0.5 rounded transition-colors"
                                >
                                    {isAr ? 'مسح' : 'Clear'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick AI presets */}
                    <div className="mb-1.5 grid grid-cols-3 gap-1">
                        <button
                            onClick={() => setSelectedCategories(LEAD_CATEGORIES.filter(c => c.channel === 'modern_trade' || c.channel === 'traditional_trade').map(c => c.id))}
                            className="text-[8px] font-black uppercase tracking-wider px-1 py-1 rounded-md bg-gradient-to-r from-orange-500/15 to-emerald-500/15 border border-orange-500/30 text-orange-200 hover:brightness-125 transition-all"
                            title="Modern + Traditional Trade"
                        >
                            {isAr ? '⚡ بضائع استهلاكية' : '⚡ FMCG'}
                        </button>
                        <button
                            onClick={() => setSelectedCategories(LEAD_CATEGORIES.filter(c => c.channel === 'horeca').map(c => c.id))}
                            className="text-[8px] font-black uppercase tracking-wider px-1 py-1 rounded-md bg-pink-500/15 border border-pink-500/30 text-pink-200 hover:brightness-125 transition-all"
                            title="Hotels, Restaurants, Cafes"
                        >
                            ☕ HoReCa
                        </button>
                        <button
                            onClick={() => setSelectedCategories(LEAD_CATEGORIES.map(c => c.id))}
                            className="text-[8px] font-black uppercase tracking-wider px-1 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:brightness-125 transition-all"
                            title="Select all categories"
                        >
                            {isAr ? '✦ الكل' : '✦ All'}
                        </button>
                    </div>

                    {/* Grouped categories — channels collapsible */}
                    {(['modern_trade', 'traditional_trade', 'horeca', 'healthcare', 'other'] as Channel[]).map(ch => {
                        const cats = LEAD_CATEGORIES.filter(c => c.channel === ch);
                        if (cats.length === 0) return null;
                        const ChIcon = CHANNEL_META[ch].icon;
                        const allSel = cats.every(c => selectedCategories.includes(c.id));
                        const someSel = cats.filter(c => selectedCategories.includes(c.id)).length;
                        const collapsed = collapsedChannels.has(ch);
                        return (
                            <div key={ch} className="mb-1 last:mb-0">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setCollapsedChannels(prev => {
                                                const next = new Set(prev);
                                                if (next.has(ch)) next.delete(ch); else next.add(ch);
                                                return next;
                                            });
                                        }}
                                        className="flex-1 flex items-center justify-between px-1 py-0.5 hover:bg-white/[0.04] rounded transition-colors"
                                    >
                                        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${CHANNEL_META[ch].color}`}>
                                            <ChIcon className="w-3.5 h-3.5" />
                                            {isAr ? CHANNEL_META[ch].labelAr : CHANNEL_META[ch].label}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] text-white/40">
                                            {someSel > 0 && <span className="text-emerald-400 font-black">{someSel}/{cats.length}</span>}
                                            <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>▸</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (allSel) {
                                                setSelectedCategories(s => s.filter(id => !cats.some(c => c.id === id)));
                                            } else {
                                                setSelectedCategories(s => Array.from(new Set([...s, ...cats.map(c => c.id)])));
                                            }
                                        }}
                                        className="text-[10px] font-black text-white/50 hover:text-cyan-300 px-1.5 py-0.5 rounded transition-colors"
                                        title={allSel ? 'Deselect all in channel' : 'Select all in channel'}
                                    >
                                        {allSel ? '✓' : '+'}
                                    </button>
                                </div>
                                {!collapsed && (
                                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                                        {cats.map(cat => {
                                            const Icon = cat.icon;
                                            const sel = selectedCategories.includes(cat.id);
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => toggleCategory(cat.id)}
                                                    className={`flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${sel ? 'border-2' : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-white/65'}`}
                                                    style={sel ? { borderColor: cat.hex, backgroundColor: `${cat.hex}1f`, color: cat.hex } : undefined}
                                                    title={isAr ? cat.labelAr : cat.label}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                    <span className="leading-tight text-center w-full">{isAr ? cat.labelAr : cat.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Scan button */}
                <button
                    onClick={handleScan}
                    disabled={isScanning || selectedCategories.length === 0}
                    className="h-10 px-3 rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-purple-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {isScanning ? (isAr ? 'جاري المسح...' : 'Scanning…') : (isAr ? 'مسح هذه المنطقة' : 'Scan This Area')}
                </button>

                {scanError && (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-[9px] text-amber-200 leading-tight">{scanError}</span>
                    </div>
                )}
            </div>

            {/* ── Top-right: Unified Results / My Leads / Legend ── */}
            <div className="absolute top-4 right-4 z-[20] flex flex-col gap-3 w-[320px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]">
                {/* Unified Results card: Stats + AI Insights + My Leads + Legend */}
                <div className="rounded-xl bg-slate-900/85 backdrop-blur-xl border border-white/10 p-3 shadow-2xl flex flex-col gap-3 overflow-hidden min-h-0">
                    {/* Stats row — only when there are scan results */}
                    {leads.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">{isAr ? 'نتائج المسح' : 'Scan Results'}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExport}
                                        disabled={visibleLeads.length === 0}
                                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40 transition-all"
                                        title={isAr ? 'تصدير كل العملاء المكتشفين' : 'Export all scanned leads'}
                                    >
                                        {isAr ? 'تصدير الكل' : 'Export All'}
                                    </button>
                                    <button onClick={clearLeads} className="text-white/50 hover:text-rose-400 transition-colors" title={isAr ? 'مسح نتائج البحث' : 'Clear scan results'}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-center px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="text-xl font-black text-emerald-300 leading-none">{leads.length}</div>
                                    <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest mt-1">{isAr ? 'عملاء جدد' : 'New Leads'}</div>
                                </div>
                                <div className="text-center px-2 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20" title="Skipped because they're already your customers">
                                    <div className="text-xl font-black text-slate-300 leading-none">{lastScanExcluded}</div>
                                    <div className="text-[9px] font-black text-slate-400/70 uppercase tracking-widest mt-1">{isAr ? 'مستبعد' : 'Excluded'}</div>
                                </div>
                            </div>
                            <div className="mt-1.5 text-[9px] text-white/40 text-center font-medium">
                                {isAr ? 'مستبعد: ≤20م أو ≤100م مع تطابق الاسم' : 'Excluded ≤20m, or ≤100m + name match'}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    {leads.length > 0 && <div className="h-px bg-white/5" />}

                    {/* AI Insights — compact single row */}
                    {aiInsights && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-[11px] font-black text-purple-300 uppercase tracking-widest">{isAr ? 'تحليل ذكي' : 'AI Insights'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Quality dial */}
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-1 min-w-0">
                                    <div className="relative w-10 h-10 shrink-0">
                                        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                                            <circle cx="18" cy="18" r="15" fill="none"
                                                stroke={aiInsights.avgQuality >= 70 ? '#10b981' : aiInsights.avgQuality >= 45 ? '#f59e0b' : '#ef4444'}
                                                strokeWidth="3.5" strokeLinecap="round"
                                                strokeDasharray={`${(aiInsights.avgQuality / 100) * 94.2} 94.2`} />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{aiInsights.avgQuality}</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-black text-purple-300 uppercase tracking-widest leading-none">{isAr ? 'متوسط الجودة' : 'Avg Q'}</div>
                                        {aiInsights.topChannel && (
                                            <div className={`text-[10px] font-black truncate mt-1 ${CHANNEL_META[aiInsights.topChannel[0]].color}`}>
                                                {isAr ? CHANNEL_META[aiInsights.topChannel[0]].labelAr : CHANNEL_META[aiInsights.topChannel[0]].label}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-center px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                                    <div className="text-base font-black text-emerald-300 leading-none">{aiInsights.closeToRoute}</div>
                                    <div className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest mt-1">{isAr ? 'قريب' : 'Near'}</div>
                                </div>
                                <div className="text-center px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                                    <div className="text-base font-black text-amber-300 leading-none">{aiInsights.newTerritory}</div>
                                    <div className="text-[9px] font-black text-amber-400/60 uppercase tracking-widest mt-1">{isAr ? 'جديد' : 'New'}</div>
                                </div>
                            </div>
                            {/* Channel mix bar */}
                            <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-white/5">
                                {Array.from(aiInsights.byChannel.entries()).map(([ch, count]) => (
                                    <div
                                        key={ch}
                                        style={{
                                            width: `${(count / aiInsights.newLeadsTotal) * 100}%`,
                                            background: ch === 'modern_trade' ? '#10b981'
                                                : ch === 'traditional_trade' ? '#f97316'
                                                : ch === 'horeca' ? '#ec4899'
                                                : ch === 'healthcare' ? '#0ea5e9' : '#64748b'
                                        }}
                                    />
                                ))}
                            </div>
                            {aiInsights.topRoute && (
                                <div className="mt-1.5 text-[10px] text-cyan-300/80 truncate">
                                    <span className="text-white/40">{isAr ? 'الأنسب ←' : 'Best fit →'}</span> <strong className="text-cyan-300">{aiInsights.topRoute[0]}</strong>
                                    <span className="text-white/30"> ({aiInsights.topRoute[1]})</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Divider before My Leads */}
                    {aiInsights && <div className="h-px bg-white/5" />}

                    {/* My Leads */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-emerald-400" />
                                <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">{isAr ? 'قائمتي' : 'My Leads'}</span>
                                {selectedLeads.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-300">
                                        {selectedLeads.length}
                                    </span>
                                )}
                            </div>
                            {selectedLeads.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExportSelected}
                                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                                        title="Export selected leads as CSV"
                                    >
                                        Export
                                    </button>
                                    <button
                                        onClick={() => setSelectedLeads([])}
                                        className="text-white/50 hover:text-rose-400 transition-colors"
                                        title="Clear all selected leads"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {selectedLeads.length === 0 ? (
                            <div className="flex items-center gap-2 py-2.5 px-2.5 rounded-lg bg-white/[0.02] border border-dashed border-white/10">
                                <CheckCircle2 className="w-5 h-5 text-white/25 shrink-0" />
                                <p className="text-[11px] text-white/50 leading-tight">
                                    {isAr ? 'انقر على أيقونة الإضافة على أي موقع' : <>Click <strong className="text-emerald-400">Add</strong> on any lead marker</>}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
                                {selectedLeads.map(lead => {
                                    const cat = CATEGORY_BY_ID[lead.categoryId];
                                    const Icon = cat?.icon || Store;
                                    return (
                                        <div key={lead.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 group hover:border-white/20 transition-all">
                                            <Icon className="w-4 h-4 shrink-0" style={{ color: cat?.hex || '#22d3ee' }} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-black text-white leading-none truncate">{lead.name}</div>
                                                <div className="text-[9px] text-white/50 mt-1 truncate">
                                                    {isAr ? (cat?.labelAr || cat?.label) : cat?.label} · <span
                                                        style={{ color: lead.qualityScore >= 70 ? '#34d399' : lead.qualityScore >= 45 ? '#fbbf24' : '#f87171' }}
                                                    >Q{lead.qualityScore}</span>
                                                    {lead.suggestedRoute && <span className="ml-1 text-cyan-400/70">→ {lead.suggestedRoute}</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleSelectLead(lead)}
                                                className="shrink-0 text-white/30 hover:text-rose-400 transition-colors"
                                                title="Remove from list"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Divider before legend */}
                    {selectedCategories.length > 0 && <div className="h-px bg-white/5" />}

                    {/* Legend (collapsible) */}
                    {selectedCategories.length > 0 && (
                        <div>
                            <button
                                onClick={() => setLegendOpen(v => !v)}
                                className="w-full flex items-center justify-between hover:bg-white/[0.04] rounded-md px-1.5 py-1 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-cyan-400" />
                                    <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">{isAr ? 'المفتاح' : 'Legend'}</span>
                                </div>
                                <span className={`text-white/40 text-xs transition-transform ${legendOpen ? 'rotate-90' : ''}`}>▸</span>
                            </button>
                            {legendOpen && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                        <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-cyan-200" />
                                        <span className="text-[10px] font-bold text-cyan-300">{isAr ? 'عميل حالي' : 'Existing customer'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5">
                                        {selectedCategories.map(id => {
                                            const c = CATEGORY_BY_ID[id];
                                            if (!c) return null;
                                            const Icon = c.icon;
                                            return (
                                                <div key={id} className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: c.hex }}>
                                                    <Icon className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{isAr ? c.labelAr : c.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty state — show only when nothing else is on screen */}
                    {leads.length === 0 && selectedCategories.length === 0 && selectedLeads.length === 0 && (
                        <div className="text-center py-3">
                            <Sparkles className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
                            <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                                {isAr ? <>حدد الأنواع، كبّر الخريطة، ثم <strong className="text-cyan-300">امسح</strong></> : <>Pick lead types, zoom in, then <strong className="text-cyan-300">Scan</strong>.</>}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom-left: zoom-level indicator */}
            <div className="absolute bottom-3 left-3 z-[20] rounded-md bg-slate-900/80 backdrop-blur-xl border border-white/10 px-2 py-1 text-[9px] font-bold text-white/60">
                {isAr ? 'أدنى تكبير للمسح: ' : 'Min scan zoom: '}<span className="text-cyan-300">{marketSettings.minZoomLevel}</span>
            </div>

            {/* Bottom-right: Locate Me button — high z-index so it stays above tall side panels */}
            <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="fixed bottom-4 right-4 z-[1500] w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 hover:brightness-110 disabled:opacity-60 shadow-xl shadow-cyan-500/50 border-2 border-cyan-300/40 flex items-center justify-center transition-all active:scale-95 group"
                title="Locate me"
            >
                {isLocating
                    ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                    : <LocateFixed className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />}
            </button>
        </div>
    );
};

export default MarketScannerV2;
