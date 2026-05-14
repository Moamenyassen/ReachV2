
// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer, CompanySettings } from '../../../types';
import { DEFAULT_COMPANY_SETTINGS } from '../../../config/constants';
import { calculateDistance } from '../../../services/optimizer';
import {
  createUserLocationIcon,
  createLeadMarkerIcon
} from '../../../services/mapIcons';
import {
  ArrowLeft, Navigation, Target, Store, ShoppingCart,
  Locate, MapPin, Radar, Flame, Loader2, ShieldCheck,
  Hash, Route, Globe, Languages, Filter, Building2,
  ChevronDown, Stethoscope, Briefcase, HeartPulse, Search,
  Calendar, Phone, Zap, PawPrint, Download, X, Eye
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

// --- STYLING ---
const DARK_MATTER_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_MATTER_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright (OSM) contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// --- RELIABLE OVERPASS MIRRORS ---
const OVERPASS_MIRRORS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// --- PERFORMANCE: CANVAS RENDERER ---
const canvasRenderer = L.canvas({ padding: 0.5 });

interface MarketScannerProps {
  existingCustomers: Customer[];
  onBack: () => void;
  isDarkMode: boolean;
  language: 'en' | 'ar';
  isAiTheme?: boolean;
  settings?: CompanySettings;
  hideHeader?: boolean;
  maxScannerCap?: number;
}

const MarketScanner: React.FC<MarketScannerProps> = ({ existingCustomers, onBack, language, isAiTheme, settings, hideHeader = false, maxScannerCap }) => {
  // Merge defaults for safety
  const marketSettings = useMemo(() => {
    return { ...DEFAULT_COMPANY_SETTINGS.modules.market, ...settings?.modules?.market };
  }, [settings]);

  const [isScanning, setIsScanning] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [mapZoom, setMapZoom] = useState(6);
  const [userPos, setUserPos] = useState<L.LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [branchFilter, setBranchFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const mapRef = useRef<L.Map | null>(null);

  const uniqueExistingClients = useMemo(() => {
    const map = new Map<string, Customer>();
    const source = branchFilter === 'All'
      ? existingCustomers
      : existingCustomers.filter(c => c.regionDescription === branchFilter);

    source.forEach(c => {
      if (!c.lat || !c.lng) return;
      const key = c.clientCode?.trim() || `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
      if (!map.has(key)) map.set(key, c);
    });
    return Array.from(map.values());
  }, [existingCustomers, branchFilter]);

  const filteredLeads = useMemo(() => {
    if (categoryFilter === 'All') return leads;
    if (categoryFilter === 'PET_CARE') {
      return leads.filter(l => l.markerType === 'VET' || l.markerType === 'PET_SHOP');
    }
    return leads;
  }, [leads, categoryFilter]);

  const availableBranches = useMemo(() => {
    const branches = new Set(existingCustomers.map(c => c.regionDescription).filter(Boolean));
    return Array.from(branches).sort();
  }, [existingCustomers]);

  const MapHandler = () => {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      const onMoveEnd = () => setMapZoom(map.getZoom());
      const onLocationFound = (e: L.LocationEvent) => {
        setUserPos(e.latlng);
        setIsLocating(false);
      };
      map.on('moveend', onMoveEnd);
      map.on('locationfound', onLocationFound);
      return () => {
        map.off('moveend', onMoveEnd);
        map.off('locationfound', onLocationFound);
      };
    }, [map]);
    const userIcon = useMemo(() => createUserLocationIcon(), []);
    // @ts-ignore
    return userPos ? <Marker position={userPos} icon={userIcon} zIndexOffset={3000} /> : null;
  };

  const handleLocateMe = () => {
    if (mapRef.current) {
      setIsLocating(true);
      mapRef.current.locate({ setView: true, maxZoom: 16 });
    }
  };

  const handleExportLeads = () => {
    if (filteredLeads.length === 0) return;

    const headers = ['Business Name', 'Arabic Name', 'Category', 'Type', 'Phone', 'Address', 'Nearest Route', 'Suggested Day', 'Distance to Route (km)', 'Lat', 'Lng'];
    const rows = filteredLeads.map(l => [
      `"${l.name}"`,
      `"${l.nameAr}"`,
      l.markerType === 'VET' || l.markerType === 'PET_SHOP' ? 'Pet Care' : 'Other',
      l.osmType,
      l.phone,
      `"${l.address}"`,
      `"${l.nearestRoute}"`,
      l.suggestedDay,
      l.distKm,
      l.lat,
      l.lng
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Market_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const performLiveScan = async () => {
    if (!mapRef.current) return;
    if (mapRef.current.getZoom() < marketSettings.minZoomLevel) {
      alert(`Please zoom in closer (Level ${marketSettings.minZoomLevel}+) for deep channel trade scanning.`);
      return;
    }

    if (maxScannerCap && leads.length >= maxScannerCap) {
      alert(`Scanner Capacity Reached! Your plan allows max ${maxScannerCap} leads. Please export or clear existing leads.`);
      return;
    }

    setIsScanning(true);
    const bounds = mapRef.current.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const englishPet = "Pet|Animal|Cat|Dog|Bird|Feed|Fodder";
    const arabicPet = "حيوانات|قطط|طيور|أليف|اليف|اليفه|أليفة|علف";
    const englishRetail = "Grocery|Market|Baqala|Supermarket";
    const arabicRetail = "بقاله|تموينات|سوبر ماركت";
    const englishVet = "Vet|Veterinary|Clinic|Medical";
    const arabicVet = "بيطري|عيادة|طبي";

    const combinedKeywords = `${englishPet}|${arabicPet}|${englishRetail}|${arabicRetail}|${englishVet}|${arabicVet}`;

    const query = `[out:json][timeout:${marketSettings.searchTimeoutSeconds}];(nwr["shop"~"pet|fodder|supermarket|grocery|convenience"](${bbox});nwr["amenity"~"veterinary"](${bbox});nwr["healthcare"~"veterinary"](${bbox});nwr["name"~"${combinedKeywords}",i](${bbox});nwr["name:en"~"${englishPet}|${englishRetail}|${englishVet}",i](${bbox});nwr["name:ar"~"${arabicPet}|${arabicRetail}|${arabicVet}",i](${bbox}););out center;`;

    const fetchWithFailover = async (retryCount = 0): Promise<any> => {
      const mirrorIndex = retryCount % OVERPASS_MIRRORS.length;
      const endpoint = OVERPASS_MIRRORS[mirrorIndex];
      try {
        const response = await fetch(endpoint, { method: 'POST', body: query });
        if (response.status === 429) throw new Error("Limit exceeded. Wait 15s.");
        if (!response.ok) throw new Error("Mirror error. Retrying...");
        return await response.json();
      } catch (err: any) {
        if (retryCount < 2) return fetchWithFailover(retryCount + 1);
        throw err;
      }
    };

    try {
      const data = await fetchWithFailover();
      const results = data.elements;
      if (!results) throw new Error("No trade data returned.");

      const newLeadsFound: any[] = [];
      const localClients = uniqueExistingClients.filter(c => bounds.contains([c.lat, c.lng]));

      // Calculate remaining capacity
      const remainingCap = maxScannerCap ? (maxScannerCap - leads.length) : Infinity;

      results.forEach((el: any) => {
        const lat = el.lat || el.center.lat;
        const lng = el.lon || el.center.lon;
        const tags = el.tags || {};
        const nameEn = tags['name:en'] || tags.name || "New Store Match";
        const nameAr = tags['name:ar'] || tags.name || "";
        const nameDisplay = tags.name || nameEn;
        const typeTag = tags.shop || tags.amenity || tags.healthcare || "Retail Unit";
        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || "N/A";
        const address = tags['addr:street'] || tags['addr:full'] || tags['addr:place'] || "Market Sector Survey Area";

        const lowerName = nameDisplay.toLowerCase();
        if (lowerName.includes("petrol") || lowerName.includes("carpet") || lowerName.includes("petromin")) return;
        const isCloseToExisting = localClients.some(c => calculateDistance(lat, lng, c.lat, c.lng) < 0.05);

        if (!isCloseToExisting) {
          let markerType: 'VET' | 'SHOP' | 'PET_SHOP' | 'UNKNOWN' = 'UNKNOWN';

          const isVetKeyword = lowerName.match(new RegExp(englishVet, 'i')) || nameAr.match(new RegExp(arabicVet, 'i'));
          const isPetKeyword = lowerName.match(new RegExp(englishPet, 'i')) || nameAr.match(new RegExp(arabicPet, 'i'));
          const isRetailKeyword = lowerName.match(new RegExp(englishRetail, 'i')) || nameAr.match(new RegExp(arabicRetail, 'i'));

          const isExplicitVet = tags.amenity === 'veterinary' || tags.healthcare === 'veterinary';
          const isExplicitPetShop = tags.shop === 'pet' || tags.shop === 'fodder';
          const isExplicitRetail = tags.shop === 'supermarket' || tags.shop === 'grocery' || tags.shop === 'convenience';

          if (isExplicitVet || isVetKeyword) markerType = 'VET';
          else if (isExplicitPetShop || isPetKeyword) markerType = 'PET_SHOP';
          else if (isExplicitRetail || isRetailKeyword) markerType = 'SHOP';

          let nearestRoute = "New Territory";
          let suggestedDay = "Survey Required";
          let minDist = Infinity;
          localClients.forEach(c => {
            const d = calculateDistance(lat, lng, c.lat, c.lng);
            if (d < minDist) {
              minDist = d;
              nearestRoute = c.routeName || "Undefined";
              suggestedDay = c.day || "Any";
            }
          });

          newLeadsFound.push({
            id: el.id, lat, lng, name: nameEn, nameAr, osmType: typeTag.toUpperCase().replace('_', ' '), markerType, address, phone, nearestRoute, suggestedDay, distKm: minDist.toFixed(2)
          });
        }
      });

      // Apply Cap
      if (newLeadsFound.length > remainingCap) {
        const truncated = newLeadsFound.slice(0, remainingCap);
        setLeads(prev => [...prev, ...truncated]);
        alert(`Plan Limit: Added ${truncated.length} leads. Truncated ${newLeadsFound.length - truncated.length} results.`);
      } else {
        setLeads(prev => [...prev, ...newLeadsFound]);
      }

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Deep scan timed out. Try a smaller area.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className={`relative h-screen w-full font-sans overflow-hidden text-white transition-colors duration-500 ${isAiTheme ? 'bg-transparent' : 'bg-[#020617]'}`}>
      {isScanning && (
        <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center">
          <div className={`absolute inset-0 transition-colors duration-500 ${isAiTheme ? 'bg-cyan-950/20 backdrop-blur-[2px]' : 'bg-red-950/20 backdrop-blur-[1px]'}`}></div>
          <Radar className={`w-32 h-32 animate-pulse transition-colors duration-500 ${isAiTheme ? 'text-cyan-500' : 'text-red-500'}`} />
          <div className={`absolute mt-40 font-black text-xs uppercase tracking-widest animate-bounce text-center px-6 transition-colors duration-500 ${isAiTheme ? 'text-cyan-400' : 'text-red-400'}`}>
            {isAiTheme ? 'Autonomous Intelligent Scanning...' : 'Aggressive "Deep Trawl" Searching...'}
            <br />
            <span className={`text-[9px] opacity-60 mt-1 block tracking-tighter transition-colors duration-500 ${isAiTheme ? 'text-cyan-500' : 'text-red-500'}`}>{isAiTheme ? '(Neural Network Analysis Active)' : '(Excluding Industrial Points)'}</span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-0">
        {/* @ts-ignore */}
        <MapContainer center={[23.8859, 45.0792]} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={false} preferCanvas={true}>
          {/* @ts-ignore */}
          <TileLayer url={DARK_MATTER_URL} attribution={DARK_MATTER_ATTR} />
          <MapHandler />
          {uniqueExistingClients.map((c, i) => (
            // @ts-ignore
            <CircleMarker key={`ex-${i}`} center={[c.lat, c.lng]} radius={4} pathOptions={{ fillColor: isAiTheme ? '#22d3ee' : '#06b6d4', color: 'white', weight: 1.5, fillOpacity: 0.9, renderer: canvasRenderer }}>
              {/* @ts-ignore */}
              <Popup className="radar-popup verified">
                <div className="p-4 w-[280px] bg-white dark:bg-gray-900 rounded-2xl border-t-[6px] border-cyan-500 shadow-2xl font-sans text-left text-gray-900 dark:text-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Verified Partner</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.clientCode && <div className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-gray-500 dark:text-gray-400">{c.clientCode}</div>}
                      {c.reachCustomerCode && <div className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-mono font-black border border-cyan-500/20">{c.reachCustomerCode}</div>}
                    </div>
                  </div>
                  <h3 className="text-sm font-black leading-tight mb-1">{c.name}</h3>
                  {c.nameAr && <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mb-4" dir="rtl">{c.nameAr}</div>}
                  <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-3 border border-slate-100 dark:border-gray-700 grid grid-cols-2 gap-3 text-xs mb-4">
                    <div><div className="text-[9px] font-bold text-gray-400 uppercase">Code</div><div className="font-mono font-bold">{c.clientCode || 'N/A'}</div></div>
                    <div><div className="text-[9px] font-bold text-gray-400 uppercase">Route</div><div className="font-bold truncate text-indigo-600 dark:text-indigo-400">{c.routeName}</div></div>
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white text-[11px] font-black rounded-xl transition-all shadow-lg shadow-indigo-900/30"><Navigation className="w-3.5 h-3.5" /> Navigate</a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {filteredLeads.map((l) => (
            // @ts-ignore
            <Marker key={l.id} position={[l.lat, l.lng]} icon={createLeadMarkerIcon(l.markerType)}>
              {/* @ts-ignore */}
              <Popup className="radar-popup lead">
                <div className="p-0 w-[280px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 font-sans text-left text-gray-900 dark:text-gray-100 overflow-hidden transition-colors">
                  <div className={`px-4 py-3 flex justify-between items-center transition-colors ${l.markerType === 'VET' ? 'bg-red-50 dark:bg-red-900/20' : l.markerType === 'PET_SHOP' ? 'bg-purple-50 dark:bg-purple-900/20' : l.markerType === 'SHOP' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-slate-50 dark:bg-gray-800'}`}>
                    <div className="flex flex-col">
                      <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm w-fit mb-1 ${l.markerType === 'VET' ? 'border-red-200 text-red-700 bg-white dark:bg-red-600 dark:text-white' : l.markerType === 'PET_SHOP' ? 'border-purple-200 text-purple-700 bg-white dark:bg-purple-600 dark:text-white' : 'border-slate-200 text-slate-700 bg-white dark:bg-gray-700 dark:text-white'}`}>
                        {l.markerType === 'VET' ? 'Vet Care' : l.markerType === 'PET_SHOP' ? 'Pet Shop' : l.markerType === 'SHOP' ? 'Retail / Trade' : 'Generic'}
                      </div>
                      <div className="text-[10px] font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-1">
                        {l.osmType}
                      </div>
                    </div>
                    {l.markerType === 'VET' ? <HeartPulse className="w-5 h-5 text-red-500" /> : l.markerType === 'PET_SHOP' ? <PawPrint className="w-5 h-5 text-purple-500" /> : <Store className="w-5 h-5 text-orange-500" />}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-black text-sm text-gray-900 dark:text-white leading-tight mb-0.5">{l.name}</h3>
                      {l.nameAr && <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400" dir="rtl">{l.nameAr}</p>}
                    </div>

                    <div className="space-y-2 border-t border-gray-50 dark:border-gray-800 pt-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-tight">{l.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-[11px] font-mono font-bold text-gray-700 dark:text-gray-200">{l.phone}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-3 border border-slate-100 dark:border-gray-700 grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Suggested Route</span>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 truncate">{l.nearestRoute}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Suggested Day</span>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{l.suggestedDay}</span>
                      </div>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-[13px] font-black shadow-lg transition-all border border-white/20 active:scale-95 ${l.markerType === 'VET' ? 'bg-red-600 hover:bg-red-700' : l.markerType === 'PET_SHOP' ? 'bg-purple-600 hover:bg-purple-700' : l.markerType === 'SHOP' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                    >
                      <Navigation className="w-4 h-4" />
                      Navigate to Target
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="absolute top-6 left-6 z-[20] flex flex-col gap-3">
        {!hideHeader && (
          <div className="flex items-center gap-3">
            <button onClick={onBack} className={`w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all shadow-2xl border ${isAiTheme ? 'bg-gray-900/60 backdrop-blur-xl border-cyan-500/30 hover:border-cyan-400 hover:bg-gray-800/80' : 'bg-slate-900/90 backdrop-blur-xl border-white/10 hover:bg-slate-800'}`}><ArrowLeft className="w-6 h-6" /></button>
            <div className={`rounded-xl px-5 py-2 shadow-2xl flex items-center gap-4 transition-all border ${isAiTheme ? 'bg-gray-900/60 backdrop-blur-xl border-cyan-500/30' : 'bg-slate-900/90 backdrop-blur-xl border-white/10'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${isAiTheme ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30' : 'bg-orange-600/20 text-orange-400 border-orange-500/30'}`}><Radar className="w-5 h-5 animate-pulse" /></div>
              <div><h2 className="text-sm font-black text-white leading-none uppercase tracking-widest">Market Scanner</h2><p className={`text-[9px] font-bold mt-1 uppercase text-left transition-colors ${isAiTheme ? 'text-cyan-400' : 'text-orange-400'}`}>Intelligent Trade Channel Search</p></div>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <div className={`rounded-xl px-4 py-2 flex flex-col min-w-[130px] shadow-2xl border transition-all ${isAiTheme ? 'bg-gray-900/60 backdrop-blur-xl border-cyan-500/20' : 'bg-slate-900/90 backdrop-blur-xl border-white/10'}`}><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Active Universe</span><span className="text-xl font-black text-cyan-400">{uniqueExistingClients.length} <span className="text-[10px] text-gray-500">Points</span></span></div>
          <div className={`rounded-xl px-4 py-2 flex flex-col min-w-[130px] shadow-2xl border-l-[4px] border transition-all ${isAiTheme ? 'bg-gray-900/60 backdrop-blur-xl border-cyan-500/20 border-l-cyan-400' : 'bg-slate-900/90 backdrop-blur-xl border-white/10 border-l-orange-500'}`}><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Detected Leads</span><span className={`text-xl font-black transition-colors ${isAiTheme ? 'text-cyan-300' : 'text-orange-400'}`}>{leads.length} <span className="text-[10px] text-gray-500">{maxScannerCap ? `/ ${maxScannerCap}` : 'Targets'}</span></span></div>
        </div>
      </div>
      <div className="absolute top-6 right-6 z-[20] flex flex-col gap-4">
        <div className={`w-80 rounded-[1.5rem] shadow-2xl flex flex-col max-h-[calc(100vh-120px)] overflow-hidden transition-all border ${isAiTheme ? 'bg-gray-900/90 backdrop-blur-2xl border-cyan-500/30' : 'bg-slate-900/95 backdrop-blur-2xl border-white/10'}`}>
          <div className={`p-4 border-b flex items-center justify-between transition-colors ${isAiTheme ? 'border-white/5 bg-cyan-900/10' : 'border-white/5 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2">
              <Filter className={`w-4 h-4 transition-colors ${isAiTheme ? 'text-cyan-400' : 'text-orange-500'}`} />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Search Control</span>
            </div>
            {filteredLeads.length > 0 && (
              <button
                onClick={handleExportLeads}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg shadow-emerald-900/20 border border-emerald-500/50"
                title="Export Leads to CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-4 space-y-4 bg-black/20">
            <div><label className="block text-[9px] font-black text-gray-500 uppercase mb-1.5 flex items-center gap-2"><Building2 className="w-3 h-3" /> Select Hub/Branch</label><div className="relative group"><select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={`w-full border text-white text-xs font-bold rounded-lg py-2.5 pl-3 pr-8 outline-none appearance-none cursor-pointer transition-all ${isAiTheme ? 'bg-gray-900 border-cyan-500/50 focus:border-cyan-400' : 'bg-slate-800 border-white/10'}`}><option value="All">All Regions</option>{availableBranches.map(b => <option key={b} value={b}>{b}</option>)}</select><ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></div></div>
            <div><label className="block text-[9px] font-black text-gray-500 uppercase mb-1.5 flex items-center gap-2"><Search className="w-3 h-3" /> Category Filter</label><div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCategoryFilter('All')} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${categoryFilter === 'All' ? (isAiTheme ? 'bg-cyan-600 border-cyan-400' : 'bg-orange-600 border-orange-400') + ' text-white' : 'bg-slate-800 border-white/5 text-gray-500 hover:bg-slate-700'}`}>All Leads</button>
              <button onClick={() => setCategoryFilter('PET_CARE')} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${categoryFilter === 'PET_CARE' ? (isAiTheme ? 'bg-purple-600 border-purple-400' : 'bg-purple-600 border-purple-500') + ' text-white' : 'bg-slate-800 border-white/5 text-gray-500 hover:bg-slate-700'}`}>Pet Care</button>
            </div></div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-black/10">{filteredLeads.length === 0 ? (<div className="py-20 text-center opacity-20 flex flex-col items-center"><Search className="w-10 h-10 mb-2" /><p className="text-[9px] font-black uppercase tracking-widest leading-relaxed">Zoom in and trigger Deep Scan</p></div>) : (filteredLeads.map(lead => (<div key={lead.id} onClick={() => mapRef.current?.flyTo([lead.lat, lead.lng], 18)} className={`p-3 border rounded-xl transition-all cursor-pointer group text-left ${isAiTheme ? 'bg-white/[0.03] hover:bg-cyan-400/10 border-white/5 hover:border-cyan-400/50' : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5'}`}><div className="flex justify-between items-start mb-1"><span className={`text-[9px] font-black uppercase flex items-center gap-1.5 transition-colors ${lead.markerType === 'VET' || lead.markerType === 'PET_SHOP' ? 'text-purple-400' : lead.markerType === 'SHOP' ? (isAiTheme ? 'text-cyan-300' : 'text-orange-400') : 'text-slate-400'}`}>{lead.markerType === 'VET' ? <HeartPulse className="w-3 h-3" /> : lead.markerType === 'PET_SHOP' ? <PawPrint className="w-3 h-3" /> : lead.markerType === 'SHOP' ? <Store className="w-3 h-3" /> : <Search className="w-3 h-3" />} {lead.osmType}</span><Flame className={`w-3 h-3 transition-all animate-pulse opacity-0 group-hover:opacity-100 ${isAiTheme ? 'text-cyan-400' : 'text-orange-500'}`} /></div><h4 className="text-[11px] font-bold text-white truncate" dir="auto">{lead.name}</h4><div className="text-[8px] text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.address}</div></div>)))}</div>
        </div>
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[30] flex flex-col items-center gap-4 w-full pointer-events-none">
        <button
          onClick={performLiveScan}
          disabled={isScanning}
          className={`pointer-events-auto relative group flex items-center justify-center w-28 h-28 rounded-full transition-all duration-300 border-[6px] ${isScanning
            ? 'bg-gray-900 border-slate-700 cursor-wait'
            : (isAiTheme ? 'bg-cyan-600 border-cyan-400/40 shadow-[0_0_50px_rgba(6,182,212,0.4)]' : 'bg-red-600 border-red-400/30 shadow-[0_0_50px_rgba(220,38,38,0.4)]') + ' hover:scale-105 active:scale-95'
            }`}
        >
          {isScanning ? (
            <Loader2 className={`w-10 h-10 animate-spin transition-colors ${isAiTheme ? 'text-cyan-300' : 'text-red-400'}`} />
          ) : (
            <div className="flex flex-col items-center justify-center text-white">
              <Radar className="w-10 h-10 animate-pulse" />
              <span className="text-[10px] font-black uppercase mt-1">Deep Scan</span>
            </div>
          )}
        </button>

        <div className={`px-8 py-2.5 rounded-full border shadow-2xl flex flex-col items-center pointer-events-auto transition-all ${isAiTheme ? 'bg-gray-900/80 backdrop-blur-xl border-cyan-500/30' : 'bg-black/80 backdrop-blur-xl border-white/10'}`}>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
            {isScanning ? (isAiTheme ? 'NEURAL NETWORK SEARCHING...' : 'TRAWLING FOR MISMATCHED LOCATIONS...') : mapZoom < marketSettings.minZoomLevel ? 'Zoom in to activate radar' : (isAiTheme ? 'Intelligent Radar Ready' : 'Deep Trawl Engine Ready')}
          </span>
        </div>
      </div>

      <div className="absolute bottom-10 left-10 z-[20] flex flex-col gap-3 text-left"><button onClick={handleLocateMe} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-2xl active:scale-90 group border ${isAiTheme ? 'bg-gray-900/60 backdrop-blur-xl border-cyan-500/30 text-cyan-400 hover:text-cyan-300' : 'bg-slate-900/90 backdrop-blur-xl border-white/10 text-white hover:text-cyan-400'}`}><Locate className={`w-6 h-6 ${isLocating ? 'animate-pulse' : 'group-hover:scale-110'}`} /></button></div>
      <style>{`
        .radar-popup .leaflet-popup-content-wrapper { background: white !important; border-radius: 1.5rem !important; padding: 0 !important; border: 1px solid rgba(0,0,0,0.05) !important; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3) !important; }
        .ai-theme .radar-popup .leaflet-popup-content-wrapper { background: rgba(10, 10, 20, 0.9) !important; border: 1px solid #38bdf8 !important; backdrop-filter: blur(8px); }
        .radar-popup .leaflet-popup-content { margin: 0 !important; }
        .radar-popup .leaflet-popup-tip { background: white !important; }
        .ai-theme .radar-popup .leaflet-popup-tip { background: rgba(10, 10, 20, 0.9) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default MarketScanner;
