// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer } from '../../../types';
import {
    Search, X, Settings, Loader2, MapPin, Plus, Check,
    ChevronRight, Home, Crosshair, Target, Filter,
    ShoppingCart, Store, Building2, Pill, Stethoscope, Hospital, Eye,
    UtensilsCrossed, Coffee, Hotel, ChefHat,
    Scissors, Shirt, Dumbbell, Fuel, Locate, Navigation,
    Phone, Clock, Star, User, Route, Tag, Info, Zap, Sparkles, Users, Calendar
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';

// ============================================================================
// ICONS - Leaflet Custom Markers
// ============================================================================

// Client Icon - Neon Blue House
const clientIcon = L.divIcon({
    className: 'bg-transparent',
    html: `
    <div class="relative flex items-center justify-center w-10 h-10 group transition-transform hover:scale-110">
      <div class="absolute inset-0 bg-cyan-500/40 rounded-full animate-ping"></div>
      <div class="relative z-10 w-7 h-7 bg-cyan-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(6,182,212,0.8)] flex items-center justify-center">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
         </svg>
      </div>
    </div>
  `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Opportunity Icon - Neon Orange/Amber Target
const opportunityIcon = L.divIcon({
    className: 'bg-transparent',
    html: `
    <div class="relative flex items-center justify-center w-10 h-10 group transition-transform hover:scale-110">
      <div class="absolute inset-0 bg-amber-500/30 rounded-full animate-ping"></div>
      <div class="relative z-10 w-7 h-7 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(245,158,11,0.8)] flex items-center justify-center">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
         </svg>
      </div>
    </div>
  `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Success/Added Icon - For animation after adding to database
const addedIcon = L.divIcon({
    className: 'bg-transparent',
    html: `
    <div class="relative flex items-center justify-center w-10 h-10 group transition-transform hover:scale-110">
      <div class="absolute inset-0 bg-emerald-500/40 rounded-full animate-ping"></div>
      <div class="relative z-10 w-7 h-7 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(16,185,129,0.8)] flex items-center justify-center">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
         </svg>
      </div>
    </div>
  `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// User Location Icon
const userLocationIcon = L.divIcon({
    className: 'bg-transparent',
    html: `
    <div class="relative w-6 h-6 flex items-center justify-center">
      <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
      <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg shadow-blue-500/50"></div>
    </div>
  `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// ============================================================================
// CATEGORY DATA - The complete filter list
// ============================================================================

const CATEGORIES = {
    retail: {
        name: 'Retail',
        icon: ShoppingCart,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        items: [
            { id: 'groceries', name: 'Groceries (Bakala)', icon: Store },
            { id: 'supermarkets', name: 'Supermarkets', icon: ShoppingCart },
            { id: 'hypermarkets', name: 'Hypermarkets', icon: Building2 },
            { id: 'malls', name: 'Malls', icon: Building2 }
        ]
    },
    health: {
        name: 'Health',
        icon: Pill,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        items: [
            { id: 'pharmacies', name: 'Pharmacies', icon: Pill },
            { id: 'polyclinics', name: 'Polyclinics', icon: Stethoscope },
            { id: 'hospitals', name: 'Hospitals', icon: Hospital },
            { id: 'optical', name: 'Optical Shops', icon: Eye }
        ]
    },
    horeca: {
        name: 'HORECA',
        icon: UtensilsCrossed,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        items: [
            { id: 'restaurants', name: 'Restaurants', icon: UtensilsCrossed },
            { id: 'cafes', name: 'Cafes', icon: Coffee },
            { id: 'hotels', name: 'Hotels', icon: Hotel },
            { id: 'catering', name: 'Catering', icon: ChefHat }
        ]
    },
    services: {
        name: 'Services',
        icon: Scissors,
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/20',
        items: [
            { id: 'salons', name: 'Barber Shops / Salons', icon: Scissors },
            { id: 'laundries', name: 'Laundries', icon: Shirt },
            { id: 'gyms', name: 'Gyms / Fitness', icon: Dumbbell },
            { id: 'gas_stations', name: 'Gas Stations', icon: Fuel }
        ]
    }
};

// ============================================================================
// MOCK DATA GENERATOR
// ============================================================================

const generateMockData = (center, bounds, allCustomers = []) => {
    const data = [];
    const allCategories = Object.values(CATEGORIES).flatMap(cat =>
        cat.items.map(item => ({ ...item, category: cat.name, categoryColor: cat.color, categoryBg: cat.bgColor }))
    );

    // Store types based on category
    const storeTypes = {
        retail: ['Franchise', 'Independent', 'Chain Store', 'Family Business'],
        health: ['Clinic Chain', 'Private Practice', 'Hospital Group', 'Independent'],
        horeca: ['Restaurant Chain', 'Independent', 'Fast Food', 'Fine Dining'],
        services: ['Franchise', 'Local Business', 'Chain', 'Boutique']
    };

    // Sample route names (matching DB format)
    const routeNames = [
        'AHMED SALEH (22999101)',
        'KHALED HASSAN (22999102)',
        'OMAR IBRAHIM (22999103)',
        'YOUSSEF ALI (22999104)',
        'TARIQ MANSOUR (22999105)'
    ];

    // Sample regions
    const regions = ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];

    // Use REAL customers from database as existing clients
    const mapBounds = bounds || { getNorth: () => center.lat + 0.03, getSouth: () => center.lat - 0.03, getEast: () => center.lng + 0.03, getWest: () => center.lng - 0.03 };
    const customersInView = allCustomers.filter(c => {
        if (!c.lat || !c.lng) return false;
        return c.lat >= mapBounds.getSouth() && c.lat <= mapBounds.getNorth() &&
            c.lng >= mapBounds.getWest() && c.lng <= mapBounds.getEast();
    });

    // Map real customers to marker format
    customersInView.forEach((customer, i) => {
        // Determine category based on storeType or classification
        const storeTypeLower = (customer.storeType || customer.classification || 'groceries').toLowerCase();
        let categoryId = 'groceries';
        let categoryName = 'Retail';
        let categoryColor = 'text-emerald-400';
        let categoryBg = 'bg-emerald-500/20';

        if (storeTypeLower.includes('pharm')) {
            categoryId = 'pharmacies'; categoryName = 'Health'; categoryColor = 'text-red-400'; categoryBg = 'bg-red-500/20';
        } else if (storeTypeLower.includes('restaurant') || storeTypeLower.includes('cafe') || storeTypeLower.includes('hotel')) {
            categoryId = 'restaurants'; categoryName = 'HORECA'; categoryColor = 'text-amber-400'; categoryBg = 'bg-amber-500/20';
        } else if (storeTypeLower.includes('salon') || storeTypeLower.includes('gym') || storeTypeLower.includes('laundry')) {
            categoryId = 'salons'; categoryName = 'Services'; categoryColor = 'text-violet-400'; categoryBg = 'bg-violet-500/20';
        }

        data.push({
            id: customer.id || `client-${i}`,
            type: 'client',
            lat: customer.lat,
            lng: customer.lng,
            name: customer.name || customer.nameAr || 'Unknown Client',
            nameAr: customer.nameAr,
            categoryId,
            categoryName,
            categoryColor,
            categoryBg,
            storeType: customer.storeType || customer.classification || 'General',
            phone: customer.phone || 'N/A',
            address: customer.address || `${customer.district || ''} ${customer.regionDescription || ''}`.trim() || 'N/A',
            distance: '0.0',
            routeName: customer.routeName || 'Unassigned',
            regionCode: customer.regionCode || '',
            day: customer.day || '',
            week: customer.week || '',
            clientCode: customer.clientCode || '',
            reachCustomerCode: customer.reachCustomerCode || '',
            branch: customer.branch || '',
            vat: customer.vat || '',
            buyerId: customer.buyerId || ''
        });
    });

    // Helper function to calculate distance between two points (Haversine formula)
    const getDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Find nearest customer and suggest their route
    const findNearestRoute = (lat, lng) => {
        const customersWithRoutes = allCustomers.filter(c => c.lat && c.lng && c.routeName);
        if (customersWithRoutes.length === 0) {
            return { route: 'No Route Available', region: '', distance: null, nearestCustomer: null };
        }

        let nearest = null;
        let minDist = Infinity;

        for (const customer of customersWithRoutes) {
            const dist = getDistance(lat, lng, customer.lat, customer.lng);
            if (dist < minDist) {
                minDist = dist;
                nearest = customer;
            }
        }

        return {
            route: nearest?.routeName || 'No Route Available',
            region: nearest?.regionCode || '',
            distance: minDist.toFixed(2),
            nearestCustomer: nearest?.name || null
        };
    };

    // Generate mock opportunities (Orange)
    const opportunityCount = Math.max(5, Math.floor(Math.random() * 15) + 10);
    for (let i = 0; i < opportunityCount; i++) {
        const latOffset = (Math.random() - 0.5) * 0.05;
        const lngOffset = (Math.random() - 0.5) * 0.05;
        const oppLat = center.lat + latOffset;
        const oppLng = center.lng + lngOffset;

        const category = allCategories[Math.floor(Math.random() * allCategories.length)];
        const categoryKey = Object.keys(CATEGORIES).find(k => CATEGORIES[k].name === category.category) || 'retail';
        const storeTypeList = storeTypes[categoryKey] || storeTypes.retail;

        // Find nearest route based on existing customers
        const nearestRouteInfo = findNearestRoute(oppLat, oppLng);

        data.push({
            id: `opportunity-${Date.now()}-${i}`,
            type: 'opportunity',
            lat: oppLat,
            lng: oppLng,
            name: `${['New', 'Fresh', 'Premium', 'Express', 'Quick', 'Family'][Math.floor(Math.random() * 6)]} ${category.name}`,
            categoryId: category.id,
            categoryName: category.category,
            categoryIcon: category.icon,
            categoryColor: category.categoryColor,
            categoryBg: category.categoryBg,
            storeType: storeTypeList[Math.floor(Math.random() * storeTypeList.length)],
            phone: `+966 5${Math.floor(Math.random() * 90000000 + 10000000)}`,
            address: `Zone ${Math.floor(Math.random() * 50) + 1}, Area ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`,
            distance: (Math.random() * 3 + 0.2).toFixed(1),
            suggestedRoute: nearestRouteInfo.route,
            suggestedRegion: nearestRouteInfo.region,
            nearestCustomerDistance: nearestRouteInfo.distance,
            nearestCustomerName: nearestRouteInfo.nearestCustomer,
            operatingHours: ['8 AM - 10 PM', '24 Hours', '9 AM - 11 PM', '7 AM - 12 AM'][Math.floor(Math.random() * 4)],
            potentialValue: ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
            source: ['Google Maps', 'OSM Data', 'Field Scout', 'Referral'][Math.floor(Math.random() * 4)]
        });
    }

    return data;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ScannerV2Props {
    onBack: () => void;
    allCustomers?: Customer[];
    onSaveCustomer?: (customer: any) => Promise<void>;
}

const ScannerV2: React.FC<ScannerV2Props> = ({ onBack, allCustomers = [], onSaveCustomer }) => {
    const SAUDI_ARABIA_CENTER = [24.7136, 46.6753]; // Riyadh as default

    // State
    const [isScanning, setIsScanning] = useState(false);
    const [markers, setMarkers] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [userPos, setUserPos] = useState(null);
    const [isLocating, setIsLocating] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [addingToDatabase, setAddingToDatabase] = useState(null);
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Route Gen State
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
    const [routeConfig, setRouteConfig] = useState({
        name: '',
        user: '',
        targetCustomers: 50,
        duration: 7,
        customersPerDay: 15,
        serviceTime: 20,
        category: 'Retail',
        branch: 'Main',
        week: 'Week 1',
        day: 'Sun'
    });

    const handleGenerateRoute = () => {
        setIsGeneratingRoute(true);
        // Simulate AI Processing
        setTimeout(() => {
            setIsGeneratingRoute(false);
            setShowRouteModal(false);
            alert(`🎉 Success! Route "${routeConfig.name}" has been generated with AI optimization.\n\n• ${routeConfig.targetCustomers} Customers Selected\n• Branch: ${routeConfig.branch}\n• Schedule: ${routeConfig.week} / ${routeConfig.day}\n• Assigned to ${routeConfig.user || 'Team Pool'}`);
        }, 2000);
    };

    // Category filter state - all enabled by default
    const [enabledCategories, setEnabledCategories] = useState(() => {
        const initial = {};
        Object.values(CATEGORIES).forEach(cat => {
            cat.items.forEach(item => {
                initial[item.id] = true;
            });
        });
        return initial;
    });

    const mapRef = useRef(null);

    // ============================================================================
    // MAP HANDLER COMPONENT
    // ============================================================================

    const MapHandler = () => {
        const map = useMap();

        useEffect(() => {
            mapRef.current = map;
            setMapCenter(map.getCenter());

            const onMoveEnd = () => setMapCenter(map.getCenter());
            const onLocationFound = (e) => {
                setUserPos(e.latlng);
                setIsLocating(false);
            };
            const onLocationError = () => setIsLocating(false);

            map.on('moveend', onMoveEnd);
            map.on('locationfound', onLocationFound);
            map.on('locationerror', onLocationError);

            return () => {
                map.off('moveend', onMoveEnd);
                map.off('locationfound', onLocationFound);
                map.off('locationerror', onLocationError);
            };
        }, [map]);

        return userPos ? <Marker position={userPos} icon={userLocationIcon} zIndexOffset={2000} /> : null;
    };

    // ============================================================================
    // ACTIONS
    // ============================================================================

    const handleLocateMe = () => {
        if (mapRef.current) {
            setIsLocating(true);
            mapRef.current.locate({ setView: true, maxZoom: 15 });
        }
    };

    const handleScan = () => {
        if (!mapCenter) return;
        setIsScanning(true);

        // Quick scan - minimal delay for UX feedback
        setTimeout(() => {
            const bounds = mapRef.current?.getBounds();
            const newData = generateMockData(mapCenter, bounds, allCustomers);
            setMarkers(newData);
            setIsScanning(false);

            // Telemetry — record this scan for sysadmin usage tracking
            try {
                const raw = localStorage.getItem('rg_v2_user');
                const u = raw ? JSON.parse(raw) : null;
                if (u?.companyId) {
                    import('../../../services/usageLogger').then(({ logMarketScan }) => {
                        logMarketScan({
                            companyId: u.companyId,
                            userId: u.id,
                            centerLat: mapCenter?.[0],
                            centerLng: mapCenter?.[1],
                            leadsFound: newData?.length || 0,
                        });
                    });
                }
            } catch { /* ignore */ }
        }, 500);
    };

    const handleAddToDatabase = async (marker) => {
        setAddingToDatabase(marker.id);

        try {
            // Prepare customer data for saving
            const customerData = {
                name: marker.name,
                lat: marker.lat,
                lng: marker.lng,
                address: marker.address,
                phone: marker.phone,
                storeType: marker.storeType,
                classification: marker.categoryName,
                routeName: marker.suggestedRoute || '',
                regionCode: marker.suggestedRegion || '',
                regionDescription: marker.suggestedRegion || '',
            };

            // Call the save function if provided
            if (onSaveCustomer) {
                await onSaveCustomer(customerData);
            }

            // Update local state to show as added
            setMarkers(prev => prev.map(m =>
                m.id === marker.id ? {
                    ...m,
                    type: 'client',
                    addedBy: 'Opportunity Scanner',
                    addedDate: new Date().toISOString()
                } : m
            ));
            setRecentlyAdded(prev => new Set([...prev, marker.id]));
            setSelectedMarker(null);

            // Remove from recently added after animation
            setTimeout(() => {
                setRecentlyAdded(prev => {
                    const next = new Set(prev);
                    next.delete(marker.id);
                    return next;
                });
            }, 2000);
        } catch (error) {
            console.error('Failed to add customer:', error);
            alert('Failed to add customer: ' + error.message);
        } finally {
            setAddingToDatabase(null);
        }
    };

    const toggleCategory = (categoryId) => {
        setEnabledCategories(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }));
    };

    const toggleCategoryGroup = (categoryKey) => {
        const items = CATEGORIES[categoryKey].items;
        const allEnabled = items.every(item => enabledCategories[item.id]);

        setEnabledCategories(prev => {
            const next = { ...prev };
            items.forEach(item => {
                next[item.id] = !allEnabled;
            });
            return next;
        });
    };

    // ============================================================================
    // FILTERED MARKERS
    // ============================================================================

    const filteredMarkers = useMemo(() => {
        return markers.filter(m => {
            // Filter by category
            if (!enabledCategories[m.categoryId]) return false;

            // Filter by search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return m.name.toLowerCase().includes(query) ||
                    m.categoryName.toLowerCase().includes(query);
            }
            return true;
        });
    }, [markers, enabledCategories, searchQuery]);

    const stats = useMemo(() => ({
        clients: filteredMarkers.filter(m => m.type === 'client').length,
        opportunities: filteredMarkers.filter(m => m.type === 'opportunity').length
    }), [filteredMarkers]);

    // ============================================================================
    // GET MARKER ICON
    // ============================================================================

    const getMarkerIcon = (marker) => {
        if (recentlyAdded.has(marker.id)) return addedIcon;
        if (marker.type === 'client') return clientIcon;
        return opportunityIcon;
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="relative h-full w-full bg-slate-950 font-sans overflow-hidden">

            {/* MAP LAYER */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={SAUDI_ARABIA_CENTER}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    className="bg-slate-900"
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <MapHandler />

                    {/* Render Markers */}
                    {filteredMarkers.map((marker) => (
                        <Marker
                            key={marker.id}
                            position={[marker.lat, marker.lng]}
                            icon={getMarkerIcon(marker)}
                            eventHandlers={{
                                click: () => setSelectedMarker(marker)
                            }}
                        >
                            <Popup className="custom-popup-dark">
                                <div className="p-3 min-w-[320px] max-w-[360px]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase flex items-center gap-1.5 ${marker.type === 'client'
                                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                            : 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                                            }`}>
                                            {marker.type === 'client' ? (
                                                <><Home className="w-3 h-3" /> Existing Client</>
                                            ) : (
                                                <><Target className="w-3 h-3" /> New Opportunity</>
                                            )}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">{marker.categoryName}</span>
                                    </div>

                                    {/* Name & Type */}
                                    <h3 className="font-bold text-white text-base leading-tight mb-1">{marker.name}</h3>

                                    {/* Store Type & Category Badge */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                            <Tag className="w-2.5 h-2.5" /> {marker.storeType || 'General'}
                                        </span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${marker.categoryBg || 'bg-slate-500/20'} ${marker.categoryColor || 'text-slate-300'} border border-white/10`}>
                                            {marker.categoryId?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Store'}
                                        </span>
                                        {marker.potentialValue && (
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${marker.potentialValue === 'High' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                marker.potentialValue === 'Medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                    'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                                                }`}>
                                                <Star className="w-2.5 h-2.5" /> {marker.potentialValue} Value
                                            </span>
                                        )}
                                    </div>

                                    {/* Details Grid */}
                                    <div className="space-y-2 mb-4">
                                        {/* Address */}
                                        <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span className="text-[11px] text-gray-300 flex-1">{marker.address}</span>
                                            <span className="text-[10px] text-amber-400 font-bold">{marker.distance} km</span>
                                        </div>

                                        {/* Phone */}
                                        <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            <span className="text-[11px] text-gray-300 font-mono">{marker.phone}</span>
                                        </div>

                                        {/* Operating Hours */}
                                        {marker.operatingHours && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                <span className="text-[11px] text-gray-300">{marker.operatingHours}</span>
                                            </div>
                                        )}

                                        {/* Client Code (for existing clients) */}
                                        {marker.clientCode && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Info className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Code:</span>
                                                <span className="text-[11px] text-white font-mono font-bold">{marker.clientCode}</span>
                                            </div>
                                        )}

                                        {marker.reachCustomerCode && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Reach ID:</span>
                                                <span className="text-[11px] text-cyan-300 font-black tracking-tighter">{marker.reachCustomerCode}</span>
                                            </div>
                                        )}

                                        {/* Arabic Name (if different) */}
                                        {marker.nameAr && marker.nameAr !== marker.name && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Name (AR):</span>
                                                <span className="text-[11px] text-white font-bold" dir="rtl">{marker.nameAr}</span>
                                            </div>
                                        )}

                                        {/* Day & Week (for existing clients) */}
                                        {(marker.day || marker.week) && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                {marker.day && (
                                                    <>
                                                        <span className="text-[10px] text-gray-400">Day:</span>
                                                        <span className="text-[11px] text-cyan-300 font-bold">{marker.day}</span>
                                                    </>
                                                )}
                                                {marker.week && (
                                                    <>
                                                        <span className="text-[10px] text-gray-400 ml-2">Week:</span>
                                                        <span className="text-[11px] text-cyan-300 font-bold">{marker.week}</span>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Branch (for existing clients) */}
                                        {marker.branch && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Branch:</span>
                                                <span className="text-[11px] text-white">{marker.branch}</span>
                                            </div>
                                        )}

                                        {/* Region Code */}
                                        {(marker.regionCode || marker.suggestedRegion) && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Region:</span>
                                                <span className="text-[11px] text-white font-bold">{marker.regionCode || marker.suggestedRegion}</span>
                                            </div>
                                        )}

                                        {/* VAT Number (for existing clients) */}
                                        {marker.vat && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">VAT:</span>
                                                <span className="text-[11px] text-gray-300 font-mono">{marker.vat}</span>
                                            </div>
                                        )}

                                        {/* Source (for opportunities) */}
                                        {marker.source && (
                                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white/5 rounded-lg border border-white/10">
                                                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="text-[10px] text-gray-400">Source:</span>
                                                <span className="text-[11px] text-gray-300">{marker.source}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Route Assignment */}
                                    <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 rounded-xl p-3 mb-4 border border-indigo-500/20">
                                        <p className="text-[9px] font-black text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Route className="w-3 h-3" />
                                            {marker.type === 'client' ? 'Current Route' : 'Suggested Route (Nearest)'}
                                        </p>
                                        <div className="bg-black/30 rounded-lg px-3 py-2">
                                            <p className="text-[12px] text-white font-bold" title={marker.routeName || marker.suggestedRoute}>
                                                {marker.routeName || marker.suggestedRoute || 'Unassigned'}
                                            </p>
                                        </div>
                                        {/* Nearest Customer Info (for opportunities) */}
                                        {marker.type === 'opportunity' && marker.nearestCustomerName && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                                                <MapPin className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[10px] text-gray-400">Nearest:</span>
                                                <span className="text-[10px] text-emerald-300 font-bold truncate max-w-[150px]" title={marker.nearestCustomerName}>
                                                    {marker.nearestCustomerName}
                                                </span>
                                                {marker.nearestCustomerDistance && (
                                                    <span className="text-[9px] text-amber-400 font-bold">
                                                        ({marker.nearestCustomerDistance} km)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {marker.rating && (
                                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-[11px] text-amber-300 font-bold">{marker.rating}</span>
                                                <span className="text-[10px] text-gray-500">Rating</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    {marker.type === 'opportunity' && (
                                        <button
                                            onClick={() => handleAddToDatabase(marker)}
                                            disabled={addingToDatabase === marker.id}
                                            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-bold py-2.5 rounded-lg transition-all shadow-lg shadow-amber-900/40 border border-amber-400/30 disabled:opacity-50"
                                        >
                                            {addingToDatabase === marker.id ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                                            ) : (
                                                <><Plus className="w-4 h-4" /> Add to Database</>
                                            )}
                                        </button>
                                    )}

                                    {marker.type === 'client' && (
                                        <div className="flex items-center justify-center gap-2 w-full bg-cyan-500/20 text-cyan-400 text-xs font-bold py-2.5 rounded-lg border border-cyan-500/30">
                                            <Check className="w-4 h-4" /> Already in Database
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Scanning Circle Animation */}
                    {isScanning && mapCenter && (
                        <Circle
                            center={mapCenter}
                            radius={1500}
                            pathOptions={{
                                color: '#f59e0b',
                                fillColor: '#f59e0b',
                                fillOpacity: 0.1,
                                weight: 2,
                                dashArray: '10, 10'
                            }}
                        />
                    )}
                </MapContainer>
            </div>

            {/* ================================================================ */}
            {/* TOP SEARCH BAR - Glassmorphism */}
            {/* ================================================================ */}
            <div className="absolute top-6 left-6 right-6 z-20">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 flex items-center gap-3">
                    {/* Search Input */}
                    <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search locations..."
                            className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-3 rounded-xl transition-all ${showFilters
                            ? 'bg-amber-500 text-black'
                            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                            }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Bar */}
                {markers.length > 0 && (
                    <div className="flex gap-3 mt-3">
                        <div className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                            <span className="text-cyan-400 text-xs font-bold">{stats.clients} Clients</span>
                        </div>
                        <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-amber-400 text-xs font-bold">{stats.opportunities} Opportunities</span>
                        </div>
                    </div>
                )}
            </div>

            {/* SMART ROUTE BUTTON (Bottom Center) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
                <button
                    onClick={() => setShowRouteModal(true)}
                    className="group relative flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-full shadow-[0_0_40px_rgba(124,58,237,0.5)] border border-white/20 hover:scale-105 transition-all"
                >
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse group-hover:animate-none" />
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span className="font-black uppercase tracking-wider text-sm">Generate AI Route</span>
                </button>
            </div>

            {/* ROUTE CONFIG MODAL */}
            {showRouteModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-500/10 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-violet-500/20 text-violet-400">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-wide">Smart Route Gen</h2>
                                    <p className="text-slate-400 text-xs">AI-Powered Optimization</p>
                                </div>
                            </div>
                            <button onClick={() => setShowRouteModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Route Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Route Name</label>
                                <input
                                    type="text"
                                    value={routeConfig.name}
                                    onChange={e => setRouteConfig({ ...routeConfig, name: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all outline-none font-bold"
                                    placeholder="e.g., Downtown Express"
                                />
                            </div>

                            {/* Related User */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assign to Agent (Rep Code)</label>
                                <input
                                    type="text"
                                    value={routeConfig.user}
                                    onChange={e => setRouteConfig({ ...routeConfig, user: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all outline-none font-bold"
                                    placeholder="e.g. AG-001"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Customer Count */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Customers</label>
                                    <div className="relative">
                                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="number"
                                            value={routeConfig.targetCustomers}
                                            onChange={e => setRouteConfig({ ...routeConfig, targetCustomers: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white focus:border-violet-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>
                                {/* Duration */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration (Days)</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="number"
                                            max={30}
                                            value={routeConfig.duration}
                                            onChange={e => setRouteConfig({ ...routeConfig, duration: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white focus:border-violet-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Cust per Day */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visits / Day</label>
                                    <input
                                        type="number"
                                        value={routeConfig.customersPerDay}
                                        onChange={e => setRouteConfig({ ...routeConfig, customersPerDay: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 outline-none font-mono"
                                    />
                                </div>
                                {/* Serving Time */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Service (Min)</label>
                                    <input
                                        type="number"
                                        value={routeConfig.serviceTime}
                                        onChange={e => setRouteConfig({ ...routeConfig, serviceTime: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            {/* Category Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Retail', 'HORECA', 'Health', 'Services'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setRouteConfig({ ...routeConfig, category: cat })}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${routeConfig.category === cat
                                                ? 'bg-violet-500/20 text-violet-300 border-violet-500/50'
                                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Branch & Schedule */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Branch */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Branch</label>
                                    <select
                                        value={routeConfig.branch}
                                        onChange={e => setRouteConfig({ ...routeConfig, branch: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all outline-none"
                                    >
                                        <option value="Main">Main Branch</option>
                                        <option value="Jeddah">Jeddah Hub</option>
                                        <option value="Riyadh">Riyadh HQ</option>
                                        <option value="Dammam">Dammam Center</option>
                                    </select>
                                </div>
                                {/* Week */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week Cycle</label>
                                    <select
                                        value={routeConfig.week}
                                        onChange={e => setRouteConfig({ ...routeConfig, week: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all outline-none"
                                    >
                                        <option value="Week 1">Week 1</option>
                                        <option value="Week 2">Week 2</option>
                                        <option value="Week 3">Week 3</option>
                                        <option value="Week 4">Week 4</option>
                                    </select>
                                </div>
                            </div>

                            {/* Day Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Day</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map(day => (
                                        <button
                                            key={day}
                                            onClick={() => setRouteConfig({ ...routeConfig, day })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${routeConfig.day === day
                                                ? 'bg-violet-500/20 text-violet-300 border-violet-500/50'
                                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 bg-slate-900/50">
                            <button
                                onClick={handleGenerateRoute}
                                disabled={isGeneratingRoute}
                                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-black uppercase tracking-wider shadow-xl shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                {isGeneratingRoute ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing 10,000+ Points...</>
                                ) : (
                                    <><Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Generate Optimized Route</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* FILTER SIDEBAR */}
            {/* ================================================================ */}
            <div className={`absolute top-0 right-0 h-full w-[340px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-30 transform transition-transform duration-300 ${showFilters ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                <Filter className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-white text-lg font-black uppercase tracking-wide">Target Categories</h2>
                                <p className="text-slate-500 text-xs">Filter by business type</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowFilters(false)}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Categories */}
                    <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                        {Object.entries(CATEGORIES).map(([key, category]) => {
                            const CategoryIcon = category.icon;
                            const allEnabled = category.items.every(item => enabledCategories[item.id]);
                            const someEnabled = category.items.some(item => enabledCategories[item.id]);

                            return (
                                <div key={key} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategoryGroup(key)}
                                        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className={`p-2 ${category.bgColor} rounded-lg ${category.color}`}>
                                            <CategoryIcon className="w-4 h-4" />
                                        </div>
                                        <span className="flex-1 text-left text-white font-bold text-sm">{category.name}</span>
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${allEnabled
                                            ? 'bg-amber-500 border-amber-500'
                                            : someEnabled
                                                ? 'border-amber-500/50 bg-amber-500/20'
                                                : 'border-slate-600'
                                            }`}>
                                            {(allEnabled || someEnabled) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </button>

                                    {/* Category Items */}
                                    <div className="border-t border-white/5">
                                        {category.items.map(item => {
                                            const ItemIcon = item.icon;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => toggleCategory(item.id)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                                                >
                                                    <ItemIcon className="w-4 h-4 text-slate-500" />
                                                    <span className="flex-1 text-left text-slate-300 text-xs">{item.name}</span>
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${enabledCategories[item.id]
                                                        ? 'bg-amber-500 border-amber-500'
                                                        : 'border-slate-600'
                                                        }`}>
                                                        {enabledCategories[item.id] && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* BOTTOM SCAN BUTTON - Glassmorphism */}
            {/* ================================================================ */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
                <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${isScanning
                        ? 'bg-slate-800/80 backdrop-blur-xl border border-slate-700 text-slate-400 cursor-wait'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-[0_0_40px_rgba(245,158,11,0.5)] hover:shadow-[0_0_60px_rgba(245,158,11,0.7)] hover:scale-105 active:scale-95'
                        }`}
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span>Scanning Area...</span>
                        </>
                    ) : (
                        <>
                            <Search className="w-6 h-6" />
                            <span>🔍 Scan Current Area</span>
                        </>
                    )}

                    {/* Pulse Ring Animation */}
                    {!isScanning && (
                        <div className="absolute inset-0 rounded-2xl animate-ping bg-amber-500/20 pointer-events-none"></div>
                    )}
                </button>
            </div>

            {/* ================================================================ */}
            {/* FLOATING CONTROLS */}
            {/* ================================================================ */}
            <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-3">
                {/* Locate Me */}
                <button
                    onClick={handleLocateMe}
                    className={`w-12 h-12 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center transition-all shadow-lg ${isLocating ? 'text-blue-400 border-blue-500/50' : 'text-white hover:bg-slate-800'
                        }`}
                >
                    {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Locate className="w-5 h-5" />}
                </button>

                {/* Reset View */}
                <button
                    onClick={() => mapRef.current?.setView(SAUDI_ARABIA_CENTER, 13)}
                    className="w-12 h-12 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-slate-800 transition-all shadow-lg"
                >
                    <Crosshair className="w-5 h-5" />
                </button>
            </div>

            {/* ================================================================ */}
            {/* LEGEND */}
            {/* ================================================================ */}
            <div className="absolute bottom-8 right-8 z-20">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Legend</p>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50"></div>
                        <span className="text-xs text-slate-300">Existing Client</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
                        <span className="text-xs text-slate-300">New Opportunity</span>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* CROSSHAIR OVERLAY */}
            {/* ================================================================ */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 opacity-20">
                <div className="w-[300px] h-[300px] border border-amber-500/30 rounded-full flex items-center justify-center relative">
                    <div className="w-[200px] h-[200px] border border-amber-500/20 rounded-full"></div>
                    <div className="absolute w-full h-[1px] bg-amber-500/20"></div>
                    <div className="absolute h-full w-[1px] bg-amber-500/20"></div>
                </div>
            </div>
        </div>
    );
};

export default ScannerV2;
