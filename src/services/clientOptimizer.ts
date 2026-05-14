import { supabase } from './supabase';
import { calculateTime } from './optimizer';

export interface OptimizationSuggestion {
    id: string;
    type: 'USER_SWAP' | 'DAY_SWAP';
    clientCode: string;
    clientName: string;
    clientArabic: string;
    district: string;
    classification: string;
    storeType: string;
    fromUser: string;
    fromDay: string;
    fromWeek: string;
    toUser: string;
    toDay: string;
    toWeek: string;
    fromRoute: string;
    toRoute: string;
    distanceSaved: number;
    timeSaved: number;
    impactScore: number;
    confidence: number;
    reason: string;
    latitude: number;
    longitude: number;
    currentRouteAvgDist: number;
    newRouteAvgDist: number;
    neighborsSample: [number, number][]; // [lat, lng]
    targetRoutePath: [number, number][]; // Ordered path for the target day
}

export interface OptimizationResult {
    success: boolean;
    totalSavings: {
        distance: number;
        time: number;
        optimizations: number;
    };
    suggestions: OptimizationSuggestion[];
    routes: string[];
    debug?: any;
}

// Haversine distance function
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees: number) {
    return degrees * (Math.PI / 180);
}

export const fetchOptimizationSuggestions = async (
    companyId: string,
    filters: { branch_code?: string; week?: string; routes?: string[] } = {},
    allowedBranches?: string[]
): Promise<OptimizationResult> => {
    try {
        console.log('Fetching customers for optimization...');
        console.log('Filters:', filters);

        // DEBUG: Check distinct route names in the data to compare with filter
        const debugRoutes = await supabase.from('company_uploaded_data').select('route_name').eq('company_id', companyId).limit(20);
        console.log('Sample Data Routes:', debugRoutes.data?.map(d => d.route_name));

        // Build query

        // Build query

        // Build query
        let query = supabase
            .from('company_uploaded_data')
            .select('client_code, customer_name_en, customer_name_ar, rep_code, day_name, week_number, route_name, district, classification, store_type, branch_code, lat, lng')
            .not('lat', 'is', null)
            .not('lng', 'is', null)
            .neq('lat', 0)
            .neq('lng', 0)
            .not('week_number', 'is', null)
            .not('day_name', 'is', null)
            .not('branch_code', 'is', null)
            .not('branch_code', 'is', null)
            .eq('company_id', companyId)
            .limit(50000);

        if (allowedBranches && allowedBranches.length > 0) {
            query = query.in('branch_code', allowedBranches);
        }

        if (filters.branch_code && filters.branch_code !== 'All Branches') query = query.eq('branch_code', filters.branch_code);
        if (filters.week && filters.week !== 'All Weeks') query = query.eq('week_number', filters.week);

        // Multi-select route filter
        if (filters.routes && filters.routes.length > 0) {
            query = query.in('route_name', filters.routes);
        }

        const { data: customers, error } = await query;

        if (error) {
            console.error('Supabase fetch error:', error);
            throw error;
        }

        if (!customers || customers.length === 0) {
            console.log('No customers found with current filters');
            return {
                success: true,
                totalSavings: { distance: 0, time: 0, optimizations: 0 },
                suggestions: [],
                routes: [],
                debug: { message: 'No customers found with valid GPS coordinates' }
            };
        }

        console.log(`Found ${customers.length} raw customers. Processing...`);

        // Extract Distinct Routes from the fetched data
        const rawRoutes = new Set<string>();
        customers.forEach((c: any) => {
            if (c.route_name) rawRoutes.add(c.route_name);
        });
        const distinctRoutes = Array.from(rawRoutes).sort();

        // Use 'any' to bypass strict type check for now
        const rawCustomers: any[] = customers.filter((c: any) => {
            const lat = parseFloat(c.lat);
            const lng = parseFloat(c.lng);
            // STRICT VALIDATION: Exclude 0,0 and invalid numbers
            return !isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001;
        });

        // STEP 2: Group by rep_code and day_name
        const routeGroups: Record<string, any[]> = {};
        rawCustomers.forEach(customer => {
            const userCode = customer.rep_code;
            const day = customer.day_name;
            const week = customer.week_number;

            if (!userCode || !day || !week) return;

            const key = `${userCode}_${day}_${week}`;
            if (!routeGroups[key]) {
                routeGroups[key] = [];
            }
            routeGroups[key].push({
                ...customer,
                _user: userCode,
                _day: day,
                _week: week,
                _order: customer.visit_order || 999, // Store visit order
                _branch: customer.branch_code
            });
        });

        console.log(`Grouped into ${Object.keys(routeGroups).length} unique routes`);

        // STEP 3: Find optimization opportunities
        const allSuggestions: OptimizationSuggestion[] = [];
        let suggestionId = 1;

        Object.keys(routeGroups).forEach(routeKey => {
            const parts = routeKey.split('_');
            const userCode = parts[0];
            const day = parts[1];
            const week = parts[2];
            const routeCustomers = routeGroups[routeKey];

            const cBranch = routeCustomers[0]?._branch;

            routeCustomers.forEach(customer => {
                const cLat = parseFloat(customer.lat);
                const cLng = parseFloat(customer.lng);
                const cClientCode = customer.client_code;
                const cRoute = customer.route_name;
                const cDistrict = customer.district;

                // Redundant check but safe
                if (isNaN(cLat) || isNaN(cLng)) return;
                if (Math.abs(cLat) < 0.0001 && Math.abs(cLng) < 0.0001) return;

                // Check other routes on same day (USER SWAP)
                Object.keys(routeGroups).forEach(otherRouteKey => {
                    const otherParts = otherRouteKey.split('_');
                    const otherUser = otherParts[0];
                    const otherDay = otherParts[1];
                    const otherWeek = otherParts[2];

                    if (otherUser === userCode || otherDay !== day || otherWeek !== week) return;

                    const otherRouteCustomers = routeGroups[otherRouteKey];
                    const otherBranch = otherRouteCustomers[0]?._branch;

                    // STRICT CONSTRAINT: Same Branch Only
                    if (cBranch !== otherBranch) return;

                    // Avg distance to other route
                    let totalDist = 0;
                    let validPoints = 0;
                    otherRouteCustomers.forEach(other => {
                        const oLat = parseFloat(other.lat);
                        const oLng = parseFloat(other.lng);
                        if (!isNaN(oLat) && !isNaN(oLng)) {
                            totalDist += calculateHaversineDistance(cLat, cLng, oLat, oLng);
                            validPoints++;
                        }
                    });

                    if (validPoints === 0) return;
                    const avgDistOther = totalDist / validPoints;

                    // Avg distance to current route
                    let currentTotal = 0;
                    let count = 0;
                    routeCustomers.forEach(rc => {
                        if (rc.client_code !== cClientCode) {
                            const rLat = parseFloat(rc.lat);
                            const rLng = parseFloat(rc.lng);
                            if (!isNaN(rLat) && !isNaN(rLng)) {
                                currentTotal += calculateHaversineDistance(cLat, cLng, rLat, rLng);
                                count++;
                            }
                        }
                    });
                    const avgDistCurrent = count > 0 ? currentTotal / count : 999;

                    const distSaved = avgDistCurrent - avgDistOther;

                    if (distSaved > 15) { // INCREASED THRESHOLD: Only strictly better changes (> 15km)
                        const timeSaved = Math.round(calculateTime(distSaved, { isUrban: true }));
                        const percentImprovement = (distSaved / avgDistCurrent) * 100;

                        // SMART FILTER: Only suggest if improvement is significant (> 20%)
                        if (percentImprovement < 20) return;

                        const impactScore = Math.min(100, Math.round(percentImprovement));

                        allSuggestions.push({
                            id: `opt_${suggestionId++}`,
                            type: 'USER_SWAP',
                            clientCode: cClientCode || 'Unknown',
                            clientName: customer.customer_name_en || 'Unknown',
                            clientArabic: customer.customer_name_ar || '',
                            district: cDistrict || '',
                            classification: customer.classification || 'N/A',
                            storeType: customer.store_type || 'N/A',
                            fromUser: userCode,
                            fromDay: day,
                            fromWeek: week,
                            toUser: otherUser,
                            toDay: otherDay,
                            toWeek: otherWeek,
                            fromRoute: cRoute || 'Unknown',
                            toRoute: otherRouteCustomers[0].route_name || 'Unknown',
                            distanceSaved: Math.round(distSaved * 10) / 10,
                            timeSaved,
                            impactScore,
                            confidence: Math.min(95, 70 + Math.round(distSaved)),
                            reason: `Customer in ${cDistrict || 'district'} is ${Math.round(distSaved)}km closer to ${otherUser}'s route based in ${cBranch}.`,
                            latitude: cLat,
                            longitude: cLng,
                            currentRouteAvgDist: Math.round(avgDistCurrent * 10) / 10,
                            newRouteAvgDist: Math.round(avgDistOther * 10) / 10,
                            neighborsSample: otherRouteCustomers
                                .slice(0, 5) // Take top 5 neighbors
                                .map(n => [parseFloat(n.lat), parseFloat(n.lng)] as [number, number])
                                .filter(p => !isNaN(p[0]) && !isNaN(p[1])),
                            targetRoutePath: otherRouteCustomers
                                .sort((a, b) => (a._order || 0) - (b._order || 0)) // Sort by visit sequence
                                .map(n => [parseFloat(n.lat), parseFloat(n.lng)] as [number, number])
                                .filter(p => !isNaN(p[0]) && !isNaN(p[1]))
                        });
                    }
                });

                // Check same user different days (DAY SWAP)
                Object.keys(routeGroups).forEach(otherRouteKey => {
                    const otherParts = otherRouteKey.split('_');
                    const otherUser = otherParts[0];
                    const otherDay = otherParts[1];
                    const otherWeek = otherParts[2];

                    if (otherUser !== userCode || otherDay === day || otherWeek !== week) return;

                    const otherDayCustomers = routeGroups[otherRouteKey];
                    const otherBranch = otherDayCustomers[0]?._branch;

                    // STRICT CONSTRAINT: Same Branch Only
                    if (cBranch !== otherBranch) return;

                    let totalDist = 0;
                    let validPoints = 0;
                    otherDayCustomers.forEach(other => {
                        const oLat = parseFloat(other.lat);
                        const oLng = parseFloat(other.lng);
                        if (!isNaN(oLat) && !isNaN(oLng)) {
                            totalDist += calculateHaversineDistance(cLat, cLng, oLat, oLng);
                            validPoints++;
                        }
                    });

                    if (validPoints === 0) return;
                    const avgDistOther = totalDist / validPoints;

                    let currentTotal = 0;
                    let count = 0;
                    routeCustomers.forEach(rc => {
                        if (rc.client_code !== cClientCode) {
                            const rLat = parseFloat(rc.lat);
                            const rLng = parseFloat(rc.lng);
                            if (!isNaN(rLat) && !isNaN(rLng)) {
                                currentTotal += calculateHaversineDistance(cLat, cLng, rLat, rLng);
                                count++;
                            }
                        }
                    });
                    const avgDistCurrent = count > 0 ? currentTotal / count : 999;

                    const distSaved = avgDistCurrent - avgDistOther;

                    if (distSaved > 5) {
                        const timeSaved = Math.round(calculateTime(distSaved, { isUrban: true }));
                        const impactScore = Math.min(100, Math.round((distSaved / avgDistCurrent) * 100));

                        allSuggestions.push({
                            id: `opt_${suggestionId++}`,
                            type: 'DAY_SWAP',
                            clientCode: cClientCode || 'Unknown',
                            clientName: customer.customer_name_en || 'Unknown',
                            clientArabic: customer.customer_name_ar || '',
                            district: cDistrict || '',
                            classification: customer.classification || 'N/A',
                            storeType: customer.store_type || 'N/A',
                            fromUser: userCode,
                            fromDay: day,
                            fromWeek: week,
                            toUser: userCode,
                            toDay: otherDay,
                            toWeek: otherWeek,
                            fromRoute: cRoute || 'Unknown',
                            toRoute: customer.route_name || 'Unknown',
                            distanceSaved: Math.round(distSaved * 10) / 10,
                            timeSaved,
                            impactScore,
                            confidence: Math.min(95, 70 + Math.round(distSaved)),
                            reason: `Customer in ${cDistrict || 'district'} creates backtracking on ${day}. Fits better on ${otherDay}.`,
                            latitude: cLat,
                            longitude: cLng,
                            currentRouteAvgDist: Math.round(avgDistCurrent * 10) / 10,
                            newRouteAvgDist: Math.round(avgDistOther * 10) / 10,
                            neighborsSample: otherDayCustomers
                                .slice(0, 5)
                                .map(n => [parseFloat(n.lat), parseFloat(n.lng)] as [number, number])
                                .filter(p => !isNaN(p[0]) && !isNaN(p[1])),
                            targetRoutePath: otherDayCustomers
                                .sort((a, b) => (a._order || 0) - (b._order || 0))
                                .map(n => [parseFloat(n.lat), parseFloat(n.lng)] as [number, number])
                                .filter(p => !isNaN(p[0]) && !isNaN(p[1]))
                        });
                    }
                });
            });
        });

        // STEP 4: Filter Distinct by clientCode (keep highest impact)
        const distinctSuggestions: OptimizationSuggestion[] = [];
        const seenClients = new Set<string>();

        // Sort by impact score descending first so we pick the best one
        allSuggestions.sort((a, b) => b.impactScore - a.impactScore);

        allSuggestions.forEach(s => {
            if (!seenClients.has(s.clientCode)) {
                seenClients.add(s.clientCode);
                distinctSuggestions.push(s);
            }
        });

        const topSuggestions = distinctSuggestions.slice(0, 20); // Focus on top 20 high-impact changes

        const totalDistance = topSuggestions.reduce((sum, s) => sum + s.distanceSaved, 0);
        const totalTime = topSuggestions.reduce((sum, s) => sum + s.timeSaved, 0);

        return {
            success: true,
            totalSavings: {
                distance: Math.round(totalDistance * 10) / 10,
                time: Math.round((totalTime / 60) * 10) / 10,
                optimizations: topSuggestions.length
            },
            suggestions: topSuggestions,
            routes: distinctRoutes,
            debug: {
                totalCustomers: customers.length,
                totalRoutes: Object.keys(routeGroups).length,
                distinctClients: seenClients.size
            }
        };

    } catch (err: any) {
        console.error('Optimization error:', err);
        return {
            success: false,
            totalSavings: { distance: 0, time: 0, optimizations: 0 },
            suggestions: [],
            routes: [],
            debug: { error: err.message }
        };
    }
};

// Refactored to sequential fetching to ensure correct filtering hierarchy
export const fetchOptimizationFilters = async (
    companyId: string,
    allowedBranches?: string[]
) => {
    try {
        // 1. Fetch Branches first
        let branchesQuery = supabase
            .from('company_branches')
            .select('id, code, name_en')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name_en');

        if (allowedBranches && allowedBranches.length > 0) {
            // userBranchIds are typically Names (e.g. "Riyadh"), so we filter by name_en
            branchesQuery = branchesQuery.in('name_en', allowedBranches);
        }

        const { data: branchesData, error: branchError } = await branchesQuery;

        if (branchError) throw branchError;

        // Map branches to standard format
        const branches = (branchesData || []).map(b => ({
            code: b.code,
            name: b.name_en || b.code
        }));

        // Get the IDs of the fetched branches for filtering routes
        const validBranchIds = (branchesData || []).map(b => b.id);

        // 2. Fetch Routes
        let routesQuery = supabase
            .from('routes')
            .select('name, branch:company_branches!inner(code, name_en)')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name');

        if (allowedBranches && allowedBranches.length > 0) {
            if (validBranchIds.length > 0) {
                // Filter routes by the actual Branch IDs we found
                routesQuery = routesQuery.in('branch_id', validBranchIds);
            } else {
                // User is restricted but no branches matched? Return empty routes.
                return { regions: [], branches: [], routes: [], routeDetails: [] };
            }
        }

        const { data: routesResponse, error: routesError } = await routesQuery;

        if (routesError) console.warn('Error fetching routes:', routesError);

        // Extract routes with their branches from the system definition
        const routeData = (routesResponse || []).map((r: any) => ({
            name: r.name,
            branch: r.branch?.name_en || 'Unassigned'
        }));

        // Unique routes just for listing
        const uniqueRoutes = Array.from(new Set(routeData.map((r: any) => r.name))).sort();

        return {
            regions: [],
            branches: branches,
            routes: uniqueRoutes,
            routeDetails: routeData // Correctly mapped from routes table
        };
    } catch (err) {
        console.error('Error fetching filters:', err);
        return { regions: [], branches: [], routes: [], routeDetails: [] };
    }
};
