// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, ScaleControl, ZoomControl } from 'react-leaflet';
import { Sun, Moon, Globe, Map as MapIcon, Focus, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Customer } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum markers rendered before we switch to simplified dots for performance */
const MAX_FULL_MARKERS = 300;
/** Above this count we skip the polyline path too (too many segments = crash) */
const MAX_POLYLINE_POINTS = 400;

const DAY_COLORS: Record<string, string> = {
  'Monday':    '#3B82F6',
  'Tuesday':   '#10B981',
  'Wednesday': '#8B5CF6',
  'Thursday':  '#F59E0B',
  'Friday':    '#EF4444',
  'Saturday':  '#EC4899',
  'Sunday':    '#6366F1',
};
const DEFAULT_COLOR = '#4f46e5';

// ─── Styles (injected once) ───────────────────────────────────────────────────
const MARKER_STYLES = `
  .reach-pin { filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3)); transition: transform 0.2s; }
  .reach-pin:hover { transform: translateY(-3px) scale(1.08); z-index: 900 !important; }
  .reach-pin.selected { z-index: 1000 !important; }
  .leaflet-popup-content-wrapper { border-radius: 14px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.18); }
  .leaflet-popup-content { margin: 0 !important; width: 240px !important; }
  .leaflet-container a.leaflet-popup-close-button { color: #9ca3af; top: 10px; right: 10px; }
  .magic-map-btn {
    background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.5); border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.2s;
    color: #4f46e5; cursor: pointer; display: flex; align-items: center;
    justify-content: center; width: 40px; height: 40px;
  }
  .magic-map-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(79,70,229,0.2); background: white; }
`;

// ─── Icon factories (shared SVG, no unique gradient IDs) ──────────────────────

// Pre-built cache so we don't recreate L.divIcon for every marker every render
const iconCache = new Map<string, L.DivIcon>();

const getNumberedIcon = (num: number, color: string, selected: boolean): L.DivIcon => {
  const key = `${num}-${color}-${selected ? 1 : 0}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const labelColor = color;
  const html = `
    <div style="position:relative;width:32px;height:42px;">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16C0 27 14 41 16 42C18 41 32 27 32 16C32 7.163 24.837 0 16 0Z" fill="${color}"/>
        <circle cx="16" cy="16" r="11" fill="white"/>
      </svg>
      <div style="position:absolute;top:0;left:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:Inter,sans-serif;font-size:${num > 99 ? 8 : num > 9 ? 10 : 12}px;color:${labelColor};">
        ${num}
      </div>
    </div>
  `;

  const icon = L.divIcon({
    className: `reach-pin ${selected ? 'selected' : ''}`,
    html,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
  iconCache.set(key, icon);
  return icon;
};

const getDotIcon = (color: string): L.DivIcon => {
  const key = `dot-${color}`;
  if (iconCache.has(key)) return iconCache.get(key)!;
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -8],
  });
  iconCache.set(key, icon);
  return icon;
};

const getDepotIcon = (): L.DivIcon => {
  if (iconCache.has('depot')) return iconCache.get('depot')!;
  const html = `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21V8L12 2L21 8V21H3Z" fill="#1f2937" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 21V16H15V21" fill="#374151"/>
      <path d="M10 11V14M14 11V14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
  const icon = L.divIcon({
    className: 'reach-pin',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
  iconCache.set('depot', icon);
  return icon;
};

// ─── FitBounds (runs once when markers change, guarded by ref) ────────────────
const FitBounds: React.FC<{ markers: any[] }> = ({ markers }) => {
  const map = useMap();
  const prevLen = useRef(-1);

  useEffect(() => {
    if (markers.length === 0 || markers.length === prevLen.current) return;
    prevLen.current = markers.length;

    const valid = markers.filter(m => m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng));
    if (valid.length === 0) return;

    requestAnimationFrame(() => {
      try {
        const bounds = L.latLngBounds(valid.map(m => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
      } catch (_) {}
    });
  }, [markers, map]);

  return null;
};

// ─── AutoFocus button ─────────────────────────────────────────────────────────
const AutoFocusControl: React.FC<{ markers: any[] }> = ({ markers }) => {
  const map = useMap();
  const handleFocus = useCallback(() => {
    const valid = markers.filter(m => m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng));
    if (!valid.length) return;
    const bounds = L.latLngBounds(valid.map(m => [m.lat, m.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [markers, map]);

  return (
    <div className="absolute top-[4.5rem] left-3 z-[1000]">
      <button onClick={e => { e.stopPropagation(); handleFocus(); }} className="magic-map-btn" title="Fit all stops">
        <Focus size={18} />
      </button>
    </div>
  );
};

// ─── Component to fix leaflet map size issues on animate-in ─────────────────
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timers = [
      setTimeout(() => map.invalidateSize(), 150),
      setTimeout(() => map.invalidateSize(), 400),
      setTimeout(() => map.invalidateSize(), 800)
    ];
    return () => timers.forEach(clearTimeout);
  }, [map]);
  return null;
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface MapVisualizerProps {
  route: Customer[];
  selectedCustomerId?: string | null;
  focusedSuggestion?: any;
  settings?: any;
  branches?: any[];
}

type MapTheme = 'street' | 'satellite' | 'dark' | 'light';

const TILE_LAYERS: Record<MapTheme, { url: string; attribution: string; maxZoom?: number }> = {
  street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                                            attribution: '© OpenStreetMap', maxZoom: 19 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',                  attribution: '© Esri', maxZoom: 18 },
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                                 attribution: '© CARTO', maxZoom: 20 },
  light:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                                attribution: '© CARTO', maxZoom: 20 },
};

const THEME_ORDER: MapTheme[] = ['street', 'satellite', 'dark', 'light'];
const THEME_ICONS = { street: <MapIcon size={18} />, satellite: <Globe size={18} />, dark: <Moon size={18} />, light: <Sun size={18} /> };

// ─── Main Component ───────────────────────────────────────────────────────────
const MapVisualizer: React.FC<MapVisualizerProps> = ({
  route,
  selectedCustomerId,
  focusedSuggestion,
  settings,
  branches,
}) => {
  const [theme, setTheme] = useState<MapTheme>('street');
  const cycleTheme = () => setTheme(t => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);

  // Build the marker list (depot + customers)
  const allMarkers = useMemo(() => {
    if (focusedSuggestion) {
      const out: any[] = [];
      if (focusedSuggestion.customer?.lat) out.push(focusedSuggestion.customer);
      if (focusedSuggestion.neighbor?.lat)  out.push({ ...focusedSuggestion.neighbor, id: 'neighbor' });
      return out;
    }

    let base: any[] = (route || []).filter(c => c.lat != null && c.lng != null && !isNaN(c.lat) && !isNaN(c.lng));

    if (settings?.modules?.map?.showUnassignedCustomers === false) {
      base = base.filter(c => c.routeName && c.routeName !== 'Unassigned');
    }

    // Prepend branch depots
    const depotMarkers: any[] = (branches || [])
      .filter(b => b.coordinates?.lat != null && b.coordinates?.lng != null)
      .map(b => ({
        id: `branch-${b.id}`,
        name: b.name,
        lat: b.coordinates.lat,
        lng: b.coordinates.lng,
        clientCode: 'BRANCH',
        routeName: 'Depot',
        day: '',
        isBranch: true,
      }));

    return [...depotMarkers, ...base];
  }, [route, focusedSuggestion, settings, branches]);

  const totalCount = allMarkers.filter(m => !m.isBranch).length;
  const isHeavy   = totalCount > MAX_FULL_MARKERS;

  // For the polyline, cap segments to avoid browser freeze
  const polylineCoords = useMemo((): [number, number][] => {
    if (allMarkers.length < 2) return [];
    const pts = allMarkers.slice(0, MAX_POLYLINE_POINTS).filter(m => m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng));
    return pts.map(m => [m.lat, m.lng]);
  }, [allMarkers]);

  const defaultCenter: [number, number] = [24.7136, 46.6753];
  const tile = TILE_LAYERS[theme];

  // Customer index counter (mutable during render, reset each time)
  let customerIdx = 0;

  return (
    <div className="h-full w-full relative z-0">
      <style>{MARKER_STYLES}</style>

      {/* Theme toggle */}
      <div className="absolute top-3 left-3 z-[1000]">
        <button onClick={cycleTheme} className="magic-map-btn" title={`Theme: ${theme}`}>
          {THEME_ICONS[theme]}
        </button>
      </div>

      {/* Heavy-data warning badge */}
      {isHeavy && (
        <div className="absolute top-3 left-[3.5rem] z-[1000] flex items-center gap-1.5 bg-amber-500/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm pointer-events-none">
          <AlertTriangle size={12} />
          Showing first {MAX_FULL_MARKERS} of {totalCount} stops (simplified view)
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%', borderRadius: '1.5rem', background: '#111827' }}
        zoomControl={false}
        preferCanvas={isHeavy}   // ← use Canvas renderer for large datasets (much faster)
      >
        <MapResizer />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" />
        <TileLayer key={tile.url} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom || 19} />

        <FitBounds markers={allMarkers} />
        <AutoFocusControl markers={allMarkers} />

        {/* Route path line — single smooth polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{ color: '#4f46e5', weight: 3, opacity: 0.65, lineCap: 'round', lineJoin: 'round', dashArray: '8, 12' }}
          />
        )}

        {/* Markers */}
        {allMarkers
          .filter(c => c.lat != null && c.lng != null && !isNaN(c.lat) && !isNaN(c.lng))
          .slice(0, MAX_FULL_MARKERS + /* always show depots */ 50)
          .map((customer, idx) => {
            const isBranch = customer.isBranch || String(customer.id).startsWith('branch-');
            const isSelected = selectedCustomerId === customer.id;

            if (!isBranch) customerIdx++;

            // Skip numbered icon for heavy datasets — use fast dot
            let icon: L.DivIcon;
            if (isBranch) {
              icon = getDepotIcon();
            } else if (isHeavy) {
              const color = customer.day ? (DAY_COLORS[customer.day] || DEFAULT_COLOR) : DEFAULT_COLOR;
              icon = getDotIcon(color);
            } else {
              const color = customer.day ? (DAY_COLORS[customer.day] || DEFAULT_COLOR) : DEFAULT_COLOR;
              icon = getNumberedIcon(customerIdx, color, isSelected);
            }

            return (
              <Marker
                key={`${customer.id ?? idx}`}
                position={[customer.lat, customer.lng]}
                icon={icon}
                zIndexOffset={isSelected ? 1000 : isBranch ? 900 : 0}
              >
                <Popup closeButton={false} className="custom-popup" offset={[0, 6]}>
                  <div className="font-sans">
                    {/* Header */}
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                      {isBranch ? (
                        <span className="bg-gray-900 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase">DEPOT</span>
                      ) : (
                        <span className="text-white px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background: customer.day ? (DAY_COLORS[customer.day] || DEFAULT_COLOR) : DEFAULT_COLOR }}>
                          #{customerIdx}
                        </span>
                      )}
                      {customer.clientCode && <span className="text-[9px] font-mono text-gray-400">{customer.clientCode}</span>}
                    </div>
                    {/* Body */}
                    <div className="p-3">
                      <h3 className="text-xs font-black text-gray-900 truncate mb-1">{customer.name}</h3>
                      {customer.nameAr && <p className="text-[10px] text-indigo-500 font-bold mb-2" dir="rtl">{customer.nameAr}</p>}
                      <div className="space-y-1 text-[10px] mb-3">
                        {customer.routeName && (
                          <div className="flex justify-between"><span className="text-gray-400 font-bold uppercase">Route</span><span className="font-bold text-gray-700 truncate max-w-[110px]">{customer.routeName}</span></div>
                        )}
                        {customer.regionDescription && (
                          <div className="flex justify-between"><span className="text-gray-400 font-bold uppercase">Region</span><span className="font-bold text-gray-700 truncate max-w-[110px]">{customer.regionDescription}</span></div>
                        )}
                        {customer.day && (
                          <div className="flex justify-between"><span className="text-gray-400 font-bold uppercase">Day</span><span className="font-bold px-1.5 py-0.5 rounded" style={{ background: (DAY_COLORS[customer.day] || DEFAULT_COLOR) + '20', color: DAY_COLORS[customer.day] || DEFAULT_COLOR }}>{customer.day}</span></div>
                        )}
                      </div>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}`, '_blank')}
                        className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                      >
                        <MapIcon size={11} /> Google Maps
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
};

export default MapVisualizer;
