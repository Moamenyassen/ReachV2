import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Circle, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import { Building2, Route as RouteIcon, Users as UsersIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BranchConfig } from '../../../types';

// --- Display-name normalization ---
// If every branch shares the same leading or trailing token (e.g. "Jeddah Consumer", "Riyadh Consumer"),
// strip the common token so labels stay short and unique.
const buildDisplayNameMap = (names: string[]): Record<string, string> => {
    const cleaned = names.filter(Boolean).map(n => n.trim());
    if (cleaned.length < 2) {
        const map: Record<string, string> = {};
        cleaned.forEach(n => { map[n] = n; });
        return map;
    }
    const tokens = cleaned.map(n => n.split(/\s+/));
    const lc = tokens.map(t => t.map(s => s.toLowerCase()));

    // Strip leading common tokens
    let leading = 0;
    while (true) {
        const t = lc[0]?.[leading];
        if (!t) break;
        if (lc.every(arr => arr[leading] === t) && lc.some(arr => arr.length > leading + 1)) leading++;
        else break;
    }

    // Strip trailing common tokens
    let trailing = 0;
    while (true) {
        const lens = lc.map(arr => arr.length);
        const idx0 = lens[0] - 1 - trailing;
        if (idx0 < leading) break;
        const t = lc[0]?.[idx0];
        if (!t) break;
        if (lc.every((arr, i) => arr[lens[i] - 1 - trailing] === t) && lens.every((len, i) => len - trailing - 1 > leading)) trailing++;
        else break;
    }

    const map: Record<string, string> = {};
    cleaned.forEach((original, i) => {
        const arr = tokens[i];
        const sliced = arr.slice(leading, arr.length - trailing);
        const result = sliced.join(' ').trim();
        map[original] = result || original; // fallback if nothing remains
    });
    return map;
};

// --- Configuration & Constants ---

// Country Border Definitions
const COUNTRY_BORDERS: Record<string, L.LatLngExpression[]> = {
    'SAUDI ARABIA': [
        [29.45, 34.96], [28.00, 34.60], [26.00, 36.50], [24.50, 37.50], [22.50, 38.90],
        [21.30, 39.10], [20.00, 40.00], [18.00, 41.50], [16.70, 42.50], [16.30, 42.80],
        [16.70, 43.30], [17.30, 43.80], [17.40, 44.50], [17.00, 46.00], [17.20, 48.00],
        [18.00, 50.00], [18.80, 52.00], [19.00, 53.00], [19.50, 55.00], [20.00, 55.60],
        [21.50, 55.50], [22.70, 55.30], [23.00, 54.00], [24.00, 52.00], [24.20, 51.60],
        [24.60, 50.80], [24.80, 50.80], [25.00, 50.50], [25.50, 50.20], [26.00, 50.10],
        [26.60, 50.00], [27.00, 49.50], [28.00, 48.80], [29.00, 48.00], [29.10, 47.00],
        [29.20, 46.00], [30.00, 44.00], [31.00, 42.00], [31.50, 40.00], [32.00, 39.00],
        [31.00, 38.00], [30.00, 37.00], [29.45, 34.96]
    ]
};

// Default Bounds (Fallback)
const DEFAULT_BOUNDS: L.LatLngBoundsExpression = [
    [15.5, 34.0], // Adjusted SW
    [32.5, 56.0]  // Adjusted NE
];

// --- Custom Icons ---

interface CustomerCluster {
    id: string;
    lat: number;
    lng: number;
    count: number;
    label?: string;
    code?: string;
    radiusKm?: number;
    pct?: number;
    topDistricts?: Array<{ name: string; count: number }>;
    rank?: number;
    tier?: 'top' | 'high' | 'mid' | 'low';
}

// Single unified emerald palette — every branch styled equally; the data tells the story in the hover card.
const BRAND = {
    primary: '#10b981',     // emerald-500
    secondary: '#14b8a6',   // teal-500
    deep: '#064e3b',        // emerald-950
    glow: 'rgba(16, 185, 129, 0.55)',
    ring: 'rgba(16, 185, 129, 0.35)',
    border: 'rgba(110, 231, 183, 0.6)', // emerald-300
    text: '#d1fae5',        // emerald-100
};

const createClusterIcon = (cluster: CustomerCluster) => {
    const count = cluster.count;
    const display = count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : count.toLocaleString();
    const name = (cluster.label || 'Branch').toUpperCase();
    // Trim very long names so the pill stays compact
    const shortName = name.length > 22 ? name.slice(0, 20) + '…' : name;

    return L.divIcon({
        className: 'reach-cluster-icon',
        html: `
          <div class="reach-branch-pill-wrap" style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <!-- Soft halo pulse anchored at the pin tip -->
            <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:${BRAND.ring};animation:cluster-pulse 2.4s ease-in-out infinite;pointer-events:none;"></div>

            <!-- Pill card -->
            <div class="reach-branch-pill" style="
                display:flex;align-items:center;gap:8px;
                padding:6px 12px 6px 6px;
                background:linear-gradient(135deg, ${BRAND.deep} 0%, #0f766e 100%);
                border:1.5px solid ${BRAND.border};
                border-radius:999px;
                box-shadow:0 4px 16px rgba(0,0,0,0.5), 0 0 18px ${BRAND.glow}55;
                white-space:nowrap;
                font-family:Inter,sans-serif;
            ">
              <!-- Branch icon disc -->
              <div style="
                  width:30px;height:30px;border-radius:50%;
                  background:linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary});
                  display:flex;align-items:center;justify-content:center;
                  box-shadow:inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px ${BRAND.glow};
                  border:1.5px solid rgba(255,255,255,0.45);
                  flex-shrink:0;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
                  <path d="M2 7h20"/>
                </svg>
              </div>

              <!-- Name + count -->
              <div style="display:flex;flex-direction:column;gap:1px;line-height:1;">
                <span style="font-size:10.5px;font-weight:800;color:white;letter-spacing:0.4px;text-shadow:0 1px 2px rgba(0,0,0,0.4);">${shortName}</span>
                <span style="font-size:10px;font-weight:800;color:${BRAND.text};font-family:'JetBrains Mono', ui-monospace, monospace;letter-spacing:0.3px;">${display} <span style="opacity:0.55;font-size:8px;letter-spacing:1px;">CLIENTS</span></span>
              </div>
            </div>

            <!-- Pin tip (downward chevron) -->
            <div style="
                width:0;height:0;
                border-left:6px solid transparent;
                border-right:6px solid transparent;
                border-top:7px solid ${BRAND.deep};
                margin-top:-1px;
                filter:drop-shadow(0 1px 0 ${BRAND.border});
            "></div>
            <div style="
                width:6px;height:6px;border-radius:50%;
                background:${BRAND.primary};
                box-shadow:0 0 6px ${BRAND.glow}, inset 0 0 0 1.5px rgba(255,255,255,0.6);
                margin-top:1px;
            "></div>
          </div>
        `,
        iconSize: [200, 60],
        // Anchor at the dot tip of the pin (bottom-center), not the pill center
        iconAnchor: [100, 60],
    });
};

const createBranchIcon = (name: string = 'Branch') => {
    const safeName = (name || 'Branch').toString();
    const shortName = safeName.length > 18 ? safeName.slice(0, 16) + '…' : safeName;

    return L.divIcon({
        className: 'reach-cluster-icon reach-branch-marker',
        html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;font-family:Inter,sans-serif;">
        <!-- Soft halo pulse anchored at the pin tip -->
        <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;background:${BRAND.ring};animation:cluster-pulse 2.4s ease-in-out infinite;pointer-events:none;"></div>

        <!-- Compact pill: icon + name -->
        <div class="reach-branch-pill-inner" style="
            display:flex;align-items:center;gap:5px;
            padding:3px 8px 3px 3px;
            background:linear-gradient(135deg, ${BRAND.deep} 0%, #0f766e 100%);
            border:1px solid ${BRAND.border};
            border-radius:999px;
            box-shadow:0 3px 10px rgba(0,0,0,0.55), 0 0 12px ${BRAND.glow}40;
            white-space:nowrap;
        ">
          <div style="
              width:18px;height:18px;border-radius:50%;
              background:linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary});
              display:flex;align-items:center;justify-content:center;
              box-shadow:inset 0 1px 0 rgba(255,255,255,0.35), 0 0 6px ${BRAND.glow};
              border:1px solid rgba(255,255,255,0.45);
              flex-shrink:0;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
            </svg>
          </div>

          <span style="font-size:9.5px;font-weight:800;color:white;letter-spacing:0.4px;text-shadow:0 1px 2px rgba(0,0,0,0.5);line-height:1;text-transform:uppercase;">${shortName}</span>
        </div>

        <!-- Pin tip -->
        <div style="
            width:0;height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-top:6px solid ${BRAND.deep};
            margin-top:-1px;
            filter:drop-shadow(0 1px 0 ${BRAND.border});
        "></div>
        <div style="
            width:5px;height:5px;border-radius:50%;
            background:${BRAND.primary};
            box-shadow:0 0 5px ${BRAND.glow}, inset 0 0 0 1px rgba(255,255,255,0.6);
            margin-top:1px;
        "></div>
      </div>
    `,
        iconSize: [140, 36],
        iconAnchor: [70, 36],
    });
};


// --- Map Controller Sub-component ---

const MapController = ({ activeBranchId, companyLocation, targetBounds, onReset, onMapReady }: { activeBranchId: string | null, companyLocation?: [number, number] | null, targetBounds: L.LatLngExpression[] | null, onReset: () => void, onMapReady: (map: L.Map) => void }) => {
    const map = useMap();

    // Capture map instance on mount and handle resize
    useEffect(() => {
        onMapReady(map);

        // Critical: Invalidate size to handle grid layout changes, then fit bounds
        const timer = setTimeout(() => {
            map.invalidateSize();
            if (targetBounds && targetBounds.length > 0) {
                map.fitBounds(L.polygon(targetBounds).getBounds(), { padding: [20, 20], maxZoom: 6, animate: false });
            } else if (companyLocation) {
                map.setView(companyLocation, 6, { animate: false });
            } else {
                map.fitBounds(DEFAULT_BOUNDS, { padding: [20, 20], maxZoom: 6, animate: false });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [map, onMapReady, companyLocation, targetBounds]);


    // Handle Reset on Background Click - Always trigger reset to default bounds
    useMapEvents({
        click: (e) => {
            // If clicking map background (not a feature)
            onReset();
            // Return to company location or Border View
            if (companyLocation) {
                map.flyTo(companyLocation, 12, { duration: 1.2 });
            } else if (targetBounds && targetBounds.length > 0) {
                map.flyToBounds(L.polygon(targetBounds).getBounds(), { padding: [20, 20], duration: 1.2, animate: true });
            }
        }
    });

    return null;
};

// --- Main Component ---

interface ReachCommandMapProps {
    companyLocation?: [number, number] | null;
    companyName?: string;
    branches?: BranchConfig[];
    branchStats?: Record<string, { routes: number; customers: number }>;
    country?: string;
    customerClusters?: CustomerCluster[];
}

const ReachCommandMap: React.FC<ReachCommandMapProps> = ({ companyLocation, companyName, branches = [], branchStats = {}, country = 'Saudi Arabia', customerClusters = [] }) => {
    const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

    // Strip common prefix/suffix tokens shared across all branch names
    const branchDisplayMap = React.useMemo(
        () => buildDisplayNameMap(branches.map(b => b.name)),
        [branches]
    );

    console.log('ReachCommandMap branches:', branches);

    // Determine Country Border
    const activeBorder = React.useMemo(() => {
        const normalizedCountry = country?.trim().toUpperCase() || 'SAUDI ARABIA';
        // Fuzzy match or direct lookup
        const key = Object.keys(COUNTRY_BORDERS).find(k => normalizedCountry.includes(k)) || 'SAUDI ARABIA';
        return COUNTRY_BORDERS[key];
    }, [country]);


    const handleBranchClick = (id: string, e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); // Prevent map click
        if (activeBranchId === id) {
            // Toggle off
            setActiveBranchId(null);
        } else {
            setActiveBranchId(id);
        }
    };

    const handleReset = () => {
        setActiveBranchId(null);
    };

    const handleAutoFocus = () => {
        if (mapInstance) {
            setActiveBranchId(null);
            if (companyLocation) {
                mapInstance.flyTo(companyLocation, 12, { duration: 1.5 });
            } else if (activeBorder && activeBorder.length > 0) {
                mapInstance.flyToBounds(L.polygon(activeBorder).getBounds(), { padding: [20, 20], maxZoom: 6, duration: 1.5 });
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-[#020617] overflow-hidden rounded-3xl group">

            {/* Styles for Pulse Ring and Border Glow */}
            <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .border-glow {
          filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.6));
        }
        @keyframes cluster-pulse {
          0%, 100% { transform: scale(0.9); opacity: 0.45; }
          50% { transform: scale(1.22); opacity: 0.9; }
        }
        @keyframes cluster-halo {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes core-flicker {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.4; }
        }
        .reach-cluster-icon { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .reach-cluster-icon:hover { transform: scale(1.12); z-index: 999 !important; filter: brightness(1.15); }
        .reach-territory-ring { transition: stroke-opacity 0.2s, fill-opacity 0.2s; }
        .reach-territory-ring:hover { stroke-opacity: 0.9 !important; fill-opacity: 0.18 !important; }

        /* Strip Leaflet's default white tooltip chrome — our cards bring their own styling */
        .leaflet-tooltip.custom-leaflet-tooltip,
        .custom-leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .custom-leaflet-tooltip::before { display: none !important; }
      `}</style>

            {/* Map Header Overlay */}
            <div className="absolute top-6 left-6 z-[400] pointer-events-none">
                <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm drop-shadow-md">
                    Strategic Map <span className="text-cyan-400">/// Live</span>
                </h3>
                <p className="text-[10px] text-gray-400 font-mono mt-1">
                    {companyLocation ? `HQ: ${companyName || 'MAIN OFFSET'}` : `VIEW: ${country?.toUpperCase() || 'REGIONAL OVERVIEW'}`}
                </p>
            </div>

            {/* Auto-Focus Button */}
            <button
                onClick={handleAutoFocus}
                className="absolute top-6 right-6 z-[400] flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 hover:border-cyan-400/60 rounded-lg transition-all duration-300 group/btn shadow-lg hover:shadow-cyan-500/20"
                title={companyLocation ? "Return to HQ" : `Auto-focus on ${country}`}
            >
                <svg className="w-4 h-4 text-cyan-400 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    <circle cx="11" cy="11" r="3" strokeWidth={2} />
                </svg>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Auto Focus</span>
            </button>

            <MapContainer
                {...({
                    center: [24.0, 45.0],
                    zoom: 6, // Start closer to KSA
                    zoomControl: false, // Custom controls
                    scrollWheelZoom: true,
                    doubleClickZoom: true
                } as any)}
                style={{ width: '100%', height: '100%', background: '#020617' }}
            >
                {/* Dark Matter Tiles */}
                <TileLayer
                    {...({ attribution: '&copy; <a href="https://www.carto.com/">CARTO</a>', url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" } as any)}
                />

                {/* Operational Border - Enhanced Visibility */}
                {activeBorder && (
                    <Polygon
                        {...({
                            positions: activeBorder,
                            pathOptions: {
                                color: '#06b6d4',
                                weight: 3,
                                fillColor: '#06b6d4',
                                fillOpacity: 0.12,
                                opacity: 1,
                                className: 'border-glow'
                            }
                        } as any)}
                    />
                )}

                {/* Logic Controller that handles Bounds Updates */}
                <MapController
                    activeBranchId={activeBranchId}
                    companyLocation={companyLocation}
                    targetBounds={activeBorder} // Focus on country by default
                    onReset={handleReset}
                    onMapReady={setMapInstance}
                />


                {/* Branch Territory Rings — uniform emerald, dashed; size encodes reach */}
                {customerClusters.map((cluster) => {
                    const radiusM = Math.max(15, cluster.radiusKm || 25) * 1000;
                    return (
                        <Circle
                            key={`territory-${cluster.id}`}
                            {...({
                                center: [cluster.lat, cluster.lng],
                                radius: radiusM,
                                pathOptions: {
                                    color: BRAND.border,
                                    fillColor: BRAND.primary,
                                    fillOpacity: 0.06,
                                    opacity: 0.45,
                                    weight: 1.25,
                                    dashArray: '6,8',
                                    className: 'reach-territory-ring',
                                }
                            } as any)}
                        />
                    );
                })}

                {/* Branch-anchored Customer Pills */}
                {customerClusters.map((cluster) => (
                    <Marker
                        key={`cluster-${cluster.id}`}
                        {...({
                            position: [cluster.lat, cluster.lng],
                            icon: createClusterIcon(cluster),
                            zIndexOffset: 600
                        } as any)}
                    >
                        <Tooltip
                            {...({
                                direction: "top",
                                offset: [0, -56],
                                opacity: 1,
                                className: "custom-leaflet-tooltip"
                            } as any)}
                        >
                            <div className="bg-[#050914]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden min-w-[260px]">
                                {/* Header — branch icon + name + code */}
                                <div className="px-4 py-3.5 border-b border-emerald-500/20 flex items-center gap-3" style={{ background: 'linear-gradient(90deg, rgba(6,78,59,0.6) 0%, rgba(15,118,110,0.25) 100%)' }}>
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 border border-emerald-300/40">
                                        <Building2 className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-black text-white uppercase tracking-[0.1em] truncate leading-tight">{cluster.label || 'Branch'}</div>
                                        {cluster.code && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Code</span>
                                                <span className="text-[10px] font-mono font-bold text-white/80">{cluster.code}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Big count + share */}
                                <div className="px-4 py-3 flex items-end justify-between gap-3 border-b border-white/5">
                                    <div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none mb-1.5">Total Clients</div>
                                        <div className="text-3xl font-black text-white leading-none tracking-tight">{cluster.count.toLocaleString()}</div>
                                    </div>
                                    {cluster.pct != null && (
                                        <div className="text-right">
                                            <div className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none mb-1.5">Share</div>
                                            <div className="text-xl font-black leading-none text-emerald-300">{cluster.pct}%</div>
                                        </div>
                                    )}
                                </div>

                                {/* Share progress bar */}
                                {cluster.pct != null && (
                                    <div className="px-4 py-2 border-b border-white/5">
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.min(100, cluster.pct)}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Stats row */}
                                <div className="px-4 py-2.5 grid grid-cols-2 gap-3 border-b border-white/5">
                                    {cluster.radiusKm != null && (
                                        <div>
                                            <div className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Reach</div>
                                            <div className="text-xs font-black text-white leading-none">{cluster.radiusKm.toFixed(0)} km</div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Coords</div>
                                        <div className="text-[10px] font-mono font-bold text-white/80 leading-none">{cluster.lat.toFixed(2)}, {cluster.lng.toFixed(2)}</div>
                                    </div>
                                </div>

                                {/* Top districts */}
                                {cluster.topDistricts && cluster.topDistricts.length > 0 && (
                                    <div className="px-4 py-2.5 border-b border-white/5">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="text-[8px] font-black uppercase tracking-widest text-white/40">Top Districts</div>
                                            <div className="text-[8px] font-black text-emerald-400/70">{cluster.topDistricts.length} of many</div>
                                        </div>
                                        <div className="space-y-1.5">
                                            {cluster.topDistricts.slice(0, 3).map((d, i) => {
                                                const pct = cluster.count > 0 ? (d.count / cluster.count) * 100 : 0;
                                                return (
                                                    <div key={i}>
                                                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                                                            <span className="text-white/80 font-bold truncate max-w-[160px]">{d.name}</span>
                                                            <span className="font-mono font-black text-white/90">{d.count.toLocaleString()}</span>
                                                        </div>
                                                        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-400/70 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Footer accent */}
                                <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent" />
                            </div>
                        </Tooltip>
                    </Marker>
                ))}

                {/* Configured Company Branches — skip branches already represented by a customer cluster */}
                {(() => {
                    const clusterIds = new Set(customerClusters.map(c => c.id));
                    return branches.map((branch, idx) => {
                    const hasLat = branch.coordinates?.lat !== undefined && branch.coordinates?.lat !== null;
                    const hasLng = branch.coordinates?.lng !== undefined && branch.coordinates?.lng !== null;
                    if (!branch.isActive || !hasLat || !hasLng) return null;
                    // Skip — the cluster icon at this branch already shows it.
                    if (clusterIds.has(branch.id)) return null;

                    const displayName = branchDisplayMap[branch.name] || branch.name;
                    const upperName = (branch.name || '').toUpperCase();
                    const stats =
                        branchStats[upperName] ||
                        branchStats[branch.name] ||
                        (branch.code ? branchStats[branch.code.toUpperCase()] : null) ||
                        { routes: 0, customers: 0 };
                    return (
                        <Marker
                            key={`configured-branch-${idx}`}
                            {...({
                                position: [branch.coordinates.lat, branch.coordinates.lng],
                                icon: createBranchIcon(displayName),
                                zIndexOffset: 900,
                                riseOnHover: true,
                                riseOffset: 2000
                            } as any)}
                        >
                            <Tooltip
                                {...({
                                    direction: "top",
                                    offset: [0, -28],
                                    opacity: 1,
                                    className: "custom-leaflet-tooltip"
                                } as any)}
                            >
                                <div className="bg-[#050914]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden min-w-[240px]">
                                    {/* Header */}
                                    <div className="px-4 py-3 border-b border-emerald-500/20 flex items-center gap-3" style={{ background: 'linear-gradient(90deg, rgba(6,78,59,0.6) 0%, rgba(15,118,110,0.25) 100%)' }}>
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 border border-emerald-300/40">
                                            <Building2 className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] font-black text-white uppercase tracking-[0.1em] truncate leading-tight">{branch.name}</div>
                                            {branch.code && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Code</span>
                                                    <span className="text-[10px] font-mono font-bold text-white/80">{branch.code}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-2 gap-px bg-white/5">
                                        <div className="px-4 py-3 bg-[#050914]/95 flex flex-col items-start gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <RouteIcon className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Routes</span>
                                            </div>
                                            <span className="text-xl font-black text-white leading-none tracking-tight">{stats.routes.toLocaleString()}</span>
                                        </div>
                                        <div className="px-4 py-3 bg-[#050914]/95 flex flex-col items-start gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <UsersIcon className="w-3 h-3 text-teal-300" />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Customers</span>
                                            </div>
                                            <span className="text-xl font-black text-white leading-none tracking-tight">{stats.customers.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Coords footer */}
                                    <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Coords</span>
                                        <span className="text-[10px] font-mono font-bold text-white/70">{branch.coordinates.lat.toFixed(2)}, {branch.coordinates.lng.toFixed(2)}</span>
                                    </div>

                                    {/* Accent strip */}
                                    <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent" />
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                });
                })()}
            </MapContainer>

            {/* Footer / Status */}
            <div className="absolute bottom-4 right-4 z-[400] flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                <span className="text-[10px] font-mono text-cyan-200/80">CONN: SECURE</span>
            </div>
        </div>
    );
};

export default React.memo(ReachCommandMap);
