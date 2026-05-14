// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OptimizationSuggestion } from '../../../services/clientOptimizer';
import { Users, Calendar, Target, ArrowLeftRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface OptimizerMapProps {
    suggestions: OptimizationSuggestion[];
    selectedSuggestion: OptimizationSuggestion | null;
    onSelectSuggestion: (id: string) => void;
}

// Map invalidator for proper rendering
const MapInvalidator = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

// Bounds controller
const MapBoundsController = ({ points }: { points: [number, number][] }) => {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            try {
                const bounds = L.latLngBounds(points);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
                }
            } catch (e) {
                console.error("Error setting bounds:", e);
            }
        } else {
            map.setView([24.7136, 46.6753], 6);
        }
    }, [map, points]);
    return null;
};

// Custom marker icon creator
const createMarkerIcon = (type: 'USER_SWAP' | 'DAY_SWAP', isSelected: boolean) => {
    const color = type === 'USER_SWAP' ? '#f97316' : '#a855f7';
    const size = isSelected ? 14 : 10;
    const borderWidth = isSelected ? 3 : 2;

    return new L.DivIcon({
        className: 'custom-marker',
        html: `
            <div style="
                width: ${size}px;
                height: ${size}px;
                background-color: ${color};
                border-radius: 50%;
                border: ${borderWidth}px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.5)'};
                box-shadow: 0 0 ${isSelected ? '15px' : '8px'} ${color}${isSelected ? '' : '80'};
                ${isSelected ? 'animation: pulse 1.5s infinite;' : ''}
            "></div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.3); opacity: 0.8; }
                }
            </style>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
};

// Customer marker - the main customer being optimized
const createCustomerIcon = (mode: 'before' | 'after') => {
    const color = mode === 'before' ? '#ef4444' : '#10b981';
    return new L.DivIcon({
        className: 'customer-marker',
        html: `
            <div style="
                width: 18px;
                height: 18px;
                background: linear-gradient(135deg, ${color}, ${mode === 'before' ? '#dc2626' : '#059669'});
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 15px ${color}, 0 2px 8px rgba(0,0,0,0.5);
                animation: customerPulse 2s infinite;
            "></div>
            <style>
                @keyframes customerPulse {
                    0%, 100% { box-shadow: 0 0 15px ${color}, 0 2px 8px rgba(0,0,0,0.5); }
                    50% { box-shadow: 0 0 25px ${color}, 0 2px 8px rgba(0,0,0,0.5); }
                }
            </style>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
};

// Neighbor marker icon - for target route neighbors
const neighborIcon = new L.DivIcon({
    className: 'neighbor-marker',
    html: `<div style="
        width: 8px;
        height: 8px;
        background-color: #6366f1;
        border-radius: 50%;
        opacity: 0.9;
        box-shadow: 0 0 8px #6366f1;
        border: 1.5px solid rgba(255,255,255,0.5);
    "></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
});

// Simulated "current" neighbors - spread around showing the customer is an outlier
const simulateCurrentNeighbors = (suggestion: OptimizationSuggestion): [number, number][] => {
    // Create a cluster of points in a different direction to show the customer is far from them
    const baseLat = suggestion.latitude;
    const baseLng = suggestion.longitude;
    const avgDist = suggestion.currentRouteAvgDist / 111; // Convert km to degrees approx

    // Place the "current route cluster" in the opposite direction of the target cluster
    const targetCentroid = suggestion.neighborsSample?.length ? {
        lat: suggestion.neighborsSample.reduce((a, b) => a + b[0], 0) / suggestion.neighborsSample.length,
        lng: suggestion.neighborsSample.reduce((a, b) => a + b[1], 0) / suggestion.neighborsSample.length
    } : null;

    // Calculate offset direction - opposite to target
    const offsetDir = targetCentroid ? {
        lat: baseLat - targetCentroid.lat,
        lng: baseLng - targetCentroid.lng
    } : { lat: 0.05, lng: 0.05 };

    // Normalize and scale
    const magnitude = Math.sqrt(offsetDir.lat ** 2 + offsetDir.lng ** 2) || 1;
    const normalizedOffset = {
        lat: (offsetDir.lat / magnitude) * avgDist * 2,
        lng: (offsetDir.lng / magnitude) * avgDist * 2
    };

    // Create cluster center for "current route"
    const clusterCenter = {
        lat: baseLat + normalizedOffset.lat,
        lng: baseLng + normalizedOffset.lng
    };

    // Generate sparse points around the cluster (to show customer is FAR from them)
    const currentNeighbors: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * 2 * Math.PI + Math.random() * 0.5;
        const dist = (avgDist * 0.3) + Math.random() * avgDist * 0.2;
        currentNeighbors.push([
            clusterCenter.lat + Math.cos(angle) * dist,
            clusterCenter.lng + Math.sin(angle) * dist
        ]);
    }

    return currentNeighbors;
};

const OptimizerMap: React.FC<OptimizerMapProps> = ({
    suggestions,
    selectedSuggestion,
    onSelectSuggestion
}) => {
    // Before/After toggle state
    const [viewMode, setViewMode] = useState<'before' | 'after'>('after');

    // Reset to 'after' when selection changes
    useEffect(() => {
        setViewMode('after');
    }, [selectedSuggestion?.id]);

    // Simulated current route neighbors for "before" view
    const currentNeighbors = useMemo(() => {
        if (!selectedSuggestion) return [];
        return simulateCurrentNeighbors(selectedSuggestion);
    }, [selectedSuggestion]);

    // Calculate map points for bounds
    const mapPoints = useMemo(() => {
        if (selectedSuggestion) {
            const points: [number, number][] = [[selectedSuggestion.latitude, selectedSuggestion.longitude]];
            if (viewMode === 'after' && selectedSuggestion.neighborsSample) {
                points.push(...selectedSuggestion.neighborsSample);
            } else if (viewMode === 'before' && currentNeighbors.length) {
                points.push(...currentNeighbors);
            }
            return points;
        }
        return suggestions
            .filter(s => s.latitude && s.longitude)
            .map(s => [s.latitude, s.longitude] as [number, number]);
    }, [suggestions, selectedSuggestion, viewMode, currentNeighbors]);

    // Calculate cluster centroid for target zone
    const targetCentroid = useMemo(() => {
        if (!selectedSuggestion?.neighborsSample?.length) return null;
        const lats = selectedSuggestion.neighborsSample.map(n => n[0]);
        const lngs = selectedSuggestion.neighborsSample.map(n => n[1]);
        return [
            lats.reduce((a, b) => a + b, 0) / lats.length,
            lngs.reduce((a, b) => a + b, 0) / lngs.length
        ] as [number, number];
    }, [selectedSuggestion]);

    // Calculate cluster centroid for current route (before)
    const currentCentroid = useMemo(() => {
        if (currentNeighbors.length === 0) return null;
        const lats = currentNeighbors.map(n => n[0]);
        const lngs = currentNeighbors.map(n => n[1]);
        return [
            lats.reduce((a, b) => a + b, 0) / lats.length,
            lngs.reduce((a, b) => a + b, 0) / lngs.length
        ] as [number, number];
    }, [currentNeighbors]);

    return (
        <div className="relative w-full h-full">
            <MapContainer
                center={[24.7136, 46.6753]}
                zoom={6}
                style={{ width: '100%', height: '100%', background: '#05060a' }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                />
                <MapInvalidator />
                <MapBoundsController points={mapPoints} />

                {/* All suggestion markers (when no selection) */}
                {!selectedSuggestion && suggestions.map(s => (
                    <Marker
                        key={s.id}
                        position={[s.latitude, s.longitude]}
                        icon={createMarkerIcon(s.type, false)}
                        eventHandlers={{
                            click: () => onSelectSuggestion(s.id)
                        }}
                    >
                        <Popup className="custom-popup">
                            <div className="text-xs">
                                <strong>{s.clientName}</strong>
                                <br />
                                <span className="text-gray-400">{s.district}</span>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* BEFORE VIEW - Current Route (Problem) */}
                {selectedSuggestion && viewMode === 'before' && (
                    <>
                        {/* Current route zone - RED/problem area */}
                        {currentCentroid && (
                            <Circle
                                center={currentCentroid}
                                radius={Math.max(3000, selectedSuggestion.currentRouteAvgDist * 600)}
                                pathOptions={{
                                    color: '#ef4444',
                                    fillColor: '#ef4444',
                                    fillOpacity: 0.1,
                                    weight: 2,
                                    dashArray: '5, 10'
                                }}
                            />
                        )}

                        {/* Long connection lines to current neighbors - showing the PROBLEM */}
                        {currentNeighbors.map((neighbor, idx) => (
                            <Polyline
                                key={`before-line-${idx}`}
                                positions={[
                                    [selectedSuggestion.latitude, selectedSuggestion.longitude],
                                    neighbor
                                ]}
                                pathOptions={{
                                    color: '#ef4444',
                                    weight: 2,
                                    opacity: 0.6,
                                    dashArray: '8, 12'
                                }}
                            />
                        ))}

                        {/* Current neighbor markers */}
                        {currentNeighbors.map((neighbor, idx) => (
                            <Marker
                                key={`before-neighbor-${idx}`}
                                position={neighbor}
                                icon={new L.DivIcon({
                                    className: 'before-neighbor',
                                    html: `<div style="
                                        width: 8px;
                                        height: 8px;
                                        background-color: #f87171;
                                        border-radius: 50%;
                                        opacity: 0.7;
                                        box-shadow: 0 0 6px #ef4444;
                                        border: 1px solid rgba(255,255,255,0.3);
                                    "></div>`,
                                    iconSize: [8, 8],
                                    iconAnchor: [4, 4]
                                })}
                            />
                        ))}

                        {/* Customer marker - RED for problem */}
                        <Marker
                            position={[selectedSuggestion.latitude, selectedSuggestion.longitude]}
                            icon={createCustomerIcon('before')}
                        />
                    </>
                )}

                {/* AFTER VIEW - Target Route (Solution) */}
                {selectedSuggestion && viewMode === 'after' && (
                    <>
                        {/* Target cluster zone - GREEN/solution area */}
                        {targetCentroid && (
                            <Circle
                                center={targetCentroid}
                                radius={Math.max(2000, selectedSuggestion.newRouteAvgDist * 800)}
                                pathOptions={{
                                    color: '#10b981',
                                    fillColor: '#10b981',
                                    fillOpacity: 0.12,
                                    weight: 2,
                                    dashArray: '8, 8'
                                }}
                            />
                        )}

                        {/* Short connection lines to target neighbors - showing the FIT */}
                        {selectedSuggestion.neighborsSample?.map((neighbor, idx) => (
                            <Polyline
                                key={`after-line-${idx}`}
                                positions={[
                                    [selectedSuggestion.latitude, selectedSuggestion.longitude],
                                    neighbor
                                ]}
                                pathOptions={{
                                    color: '#10b981',
                                    weight: 1.5,
                                    opacity: 0.5,
                                    dashArray: '4, 8'
                                }}
                            />
                        ))}

                        {/* Main connection to centroid */}
                        {targetCentroid && (
                            <Polyline
                                positions={[
                                    [selectedSuggestion.latitude, selectedSuggestion.longitude],
                                    targetCentroid
                                ]}
                                pathOptions={{
                                    color: '#10b981',
                                    weight: 3,
                                    opacity: 0.9
                                }}
                            />
                        )}

                        {/* Target route path if available */}
                        {selectedSuggestion.targetRoutePath?.length > 1 && (
                            <Polyline
                                positions={selectedSuggestion.targetRoutePath}
                                pathOptions={{
                                    color: '#6366f1',
                                    weight: 4,
                                    opacity: 0.4,
                                    lineJoin: 'round',
                                    lineCap: 'round'
                                }}
                            />
                        )}

                        {/* Target neighbor markers */}
                        {selectedSuggestion.neighborsSample?.map((neighbor, idx) => (
                            <Marker
                                key={`after-neighbor-${idx}`}
                                position={neighbor}
                                icon={neighborIcon}
                            />
                        ))}

                        {/* Customer marker - GREEN for solution */}
                        <Marker
                            position={[selectedSuggestion.latitude, selectedSuggestion.longitude]}
                            icon={createCustomerIcon('after')}
                        />
                    </>
                )}
            </MapContainer>

            {/* Before/After Toggle - Only show when a suggestion is selected */}
            {selectedSuggestion && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-xl">
                        <button
                            onClick={() => setViewMode('before')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'before'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <AlertTriangle size={14} />
                            Before
                        </button>
                        <div className="w-px h-5 bg-white/10" />
                        <button
                            onClick={() => setViewMode('after')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'after'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <CheckCircle2 size={14} />
                            After
                        </button>
                    </div>
                </div>
            )}

            {/* Info Panel */}
            {selectedSuggestion && (
                <div className="absolute top-20 left-4 z-[1000]">
                    <div className={`backdrop-blur-xl border rounded-xl px-4 py-3 max-w-[280px] shadow-xl ${viewMode === 'before'
                            ? 'bg-red-950/80 border-red-500/20'
                            : 'bg-emerald-950/80 border-emerald-500/20'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {viewMode === 'before' ? (
                                <AlertTriangle size={14} className="text-red-400" />
                            ) : (
                                <CheckCircle2 size={14} className="text-emerald-400" />
                            )}
                            <span className={`text-xs font-bold uppercase tracking-wide ${viewMode === 'before' ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                {viewMode === 'before' ? 'Current Problem' : 'Optimized Solution'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed">
                            {viewMode === 'before' ? (
                                <>
                                    <strong className="text-white">{selectedSuggestion.clientName}</strong> is an outlier on <strong className="text-red-400">{selectedSuggestion.fromUser}</strong>'s route, averaging <strong className="text-red-400">{selectedSuggestion.currentRouteAvgDist} km</strong> from neighbors.
                                </>
                            ) : (
                                <>
                                    Moving to <strong className="text-emerald-400">{selectedSuggestion.toUser}</strong>'s route reduces distance to just <strong className="text-emerald-400">{selectedSuggestion.newRouteAvgDist} km</strong> from neighbors.
                                </>
                            )}
                        </p>
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[10px] text-gray-500">Avg Distance to Neighbors</span>
                            <span className={`text-sm font-bold ${viewMode === 'before' ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                {viewMode === 'before'
                                    ? selectedSuggestion.currentRouteAvgDist
                                    : selectedSuggestion.newRouteAvgDist} km
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center justify-center gap-6">
                    {viewMode === 'before' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-2 border-white shadow-lg shadow-red-500/50" />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Customer (Outlier)</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400/70 border border-white/30" />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Current Route Stops</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }} />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Long Distance</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 border-2 border-white shadow-lg shadow-emerald-500/50" />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Customer (Fits Well)</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 border border-white/30" />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Target Route Stops</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border-2 border-dashed border-emerald-500" />
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Target Zone</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Viewing customer info */}
            {selectedSuggestion && (
                <div className="absolute top-4 left-4 z-[1000]">
                    <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Target size={12} className="text-indigo-400" />
                        <span className="text-[10px] text-gray-300">
                            Viewing: <strong className="text-white">{selectedSuggestion.clientName}</strong>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OptimizerMap;
