// @ts-nocheck
import React, { useMemo } from 'react';
import { OptimizationSuggestion } from '../../../types/optimizer';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

interface RouteMapProps {
    selectedSuggestion?: OptimizationSuggestion;
    allSuggestions: OptimizationSuggestion[];
}

const RouteMap: React.FC<RouteMapProps> = ({ selectedSuggestion, allSuggestions }) => {

    // Custom Hook to fit bounds
    const MapBounds = () => {
        const map = useMap();

        useMemo(() => {
            if (!selectedSuggestion) return;

            const { latitude, longitude, from, to } = selectedSuggestion;
            // Basic bounds including customer and implicit route centers (approximate for visual context)
            const bounds = L.latLngBounds([
                [latitude, longitude],
                [latitude + 0.05, longitude + 0.05], // Dummy offset to ensure bounds valid if single point
                [latitude - 0.05, longitude - 0.05]
            ]);

            map.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
        }, [selectedSuggestion, map]);

        return null;
    };

    const center: [number, number] = [24.7136, 46.6753]; // Default Riyadh

    // Marker Icons
    const customerIcon = new L.DivIcon({
        className: 'bg-transparent',
        html: `<div class="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-lg animate-pulse ring-4 ring-orange-500/20"></div>`,
        iconSize: [12, 12]
    });

    return (
        <div className="h-full w-full bg-gray-950 relative">
            {/* @ts-ignore */}
            <MapContainer center={center} zoom={11} style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
                {/* @ts-ignore */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapBounds />

                {/* Render Selected Suggestion Context */}
                {selectedSuggestion && (
                    <>
                        {/* Customer Marker */}
                        {/* @ts-ignore */}
                        <Marker position={[selectedSuggestion.latitude, selectedSuggestion.longitude]} icon={customerIcon}>
                            {/* @ts-ignore */}
                            <Tooltip permanent direction="top" offset={[0, -10]} className="!bg-black/80 !border-gray-700 !text-white !px-2 !py-1 !rounded !font-bold">
                                {selectedSuggestion.clientName}
                            </Tooltip>
                        </Marker>

                        {/* Visual Vector Lines (Simulated for Demo - in real-app would need actual route geometries) */}
                        {/* Current Route Path Indication (Red dotted) */}
                        <Polyline
                            positions={[
                                [selectedSuggestion.latitude, selectedSuggestion.longitude],
                                [selectedSuggestion.latitude + 0.02, selectedSuggestion.longitude + 0.01] // Simulated Route Center
                            ]}
                            pathOptions={{ color: '#ef4444', weight: 2, dashArray: '5, 5', opacity: 0.6 }}
                        />

                        {/* Target Route Path Indication (Green solid) */}
                        <Polyline
                            positions={[
                                [selectedSuggestion.latitude, selectedSuggestion.longitude],
                                [selectedSuggestion.latitude - 0.015, selectedSuggestion.longitude - 0.02] // Simulated Target Center
                            ]}
                            pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.8 }}
                        />
                    </>
                )}

                {/* Other suggestions as small dots */}
                {allSuggestions.filter(s => s.id !== selectedSuggestion?.id).map(s => {
                    // @ts-ignore
                    return (
                        <Marker
                            key={s.id}
                            position={[s.latitude, s.longitude]}
                            icon={new L.DivIcon({
                                className: 'bg-transparent',
                                html: `<div class="w-1.5 h-1.5 bg-gray-500 rounded-full opacity-50"></div>`,
                                iconSize: [6, 6]
                            })}
                        />
                    );
                })}

            </MapContainer>

            {/* Map Legend */}
            <div className="absolute bottom-5 left-5 z-[500] bg-gray-900/90 backdrop-blur border border-gray-800 p-3 rounded-lg shadow-xl">
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Legend</div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span className="text-xs text-gray-300">Target Customer</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 border-t-2 border-dashed border-red-500"></div>
                        <span className="text-xs text-gray-300">Remove from Route</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 bg-green-500"></div>
                        <span className="text-xs text-gray-300">New Assignment</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteMap;
