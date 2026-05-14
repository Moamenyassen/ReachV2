
import { Customer, RouteSummary, RouteSegment, AISuggestion } from '../types';
import { AVG_SPEED_KMH, SERVICE_TIME_MIN, DRIVING_DISTANCE_FACTOR, TRAFFIC_FACTOR } from '../config/constants';

export interface OptimizerConfig {
  avgSpeedKmh: number;
  serviceTimeMin: number;
  trafficFactor: number;
  drivingDistanceFactor: number;
  maxDistancePerRouteKm?: number;
  breakTimeMin?: number;
  maxWorkingHours?: number;
  startLocation?: 'DEPOT' | 'HOME';
  costObjective?: 'BALANCED' | 'DISTANCE' | 'TIME';
  googleMapsApiKey?: string;
}

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

// Haversine formula to calculate distance between two points in km
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

// Calculate driving time in minutes given distance in km, including traffic factor
export const calculateTime = (distanceKm: number, config: Partial<OptimizerConfig> & { isUrban?: boolean, regionCode?: string } = {}): number => {
  const {
    avgSpeedKmh = AVG_SPEED_KMH,
    trafficFactor = TRAFFIC_FACTOR,
    isUrban = false
  } = config;

  // --- Smart Heuristic Logic ---
  // 1. Dynamic Speed based on Segment Length (Urban vs Highway Efficiency)
  let baseSpeed = avgSpeedKmh;

  if (distanceKm < 0.5) {
    baseSpeed = 12; // Hyper-local (Parking, U-turns, short alleys)
  } else if (distanceKm < 2.0) {
    baseSpeed = 22; // Residential / Neighborhood
  } else if (distanceKm < 5.0) {
    baseSpeed = 38; // Minor Arterials
  } else if (distanceKm < 15.0) {
    baseSpeed = 55; // Major Arterials / Ring Roads
  } else {
    baseSpeed = 85; // Inter-city / Highway
  }

  // Adjust for Urban Density if explicitly known or for very short segments
  if (isUrban || distanceKm < 3.0) {
    baseSpeed = baseSpeed * 0.85; // 15% reduction for high-density congestion
  }

  // Ensure we don't exceed a realistic floor
  const finalSpeed = Math.max(baseSpeed, 10);

  // Base time in minutes
  let minutes = (distanceKm / finalSpeed) * 60;

  // 2. Traffic Factor Overheads
  let appliedTrafficFactor = trafficFactor;

  // Short urban hops suffer more from signal delays and turns
  if (distanceKm < 1.0) {
    appliedTrafficFactor = Math.max(trafficFactor, 1.45);
  } else if (distanceKm < 5.0) {
    appliedTrafficFactor = Math.max(trafficFactor, 1.25);
  }

  // TODO: Future integration with real-time mapping services (Google/Mapbox)
  if (config.googleMapsApiKey) {
    // Placeholder: await fetchRealTimeTraffic(...)
  }

  return minutes * appliedTrafficFactor;
};

// Analyze Same Location (0-20 meters) - Optimized Sort & Sweep O(N log N)
export const analyzeSameLocation = (customers: Customer[]): Set<string> => {
  const sameLocIds = new Set<string>();
  const validCustomers = customers.filter(c => c.lat !== 0 && c.lng !== 0 && !isNaN(c.lat) && !isNaN(c.lng));

  if (validCustomers.length < 2) return sameLocIds;

  // 1. Sort by Latitude
  validCustomers.sort((a, b) => a.lat - b.lat);

  // 2. Sweep
  const LAT_WINDOW_DEG = 0.0003; // Approx 30m

  for (let i = 0; i < validCustomers.length; i++) {
    const c1 = validCustomers[i];

    // Look ahead only
    for (let j = i + 1; j < validCustomers.length; j++) {
      const c2 = validCustomers[j];

      // Break if latitude difference is too large (Sorted property usage)
      if (c2.lat - c1.lat > LAT_WINDOW_DEG) break;

      // Check Longitude difference
      if (Math.abs(c1.lng - c2.lng) > LAT_WINDOW_DEG) continue;

      // Precise Check
      const dist = calculateDistance(c1.lat, c1.lng, c2.lat, c2.lng);
      if (dist <= 0.02) { // 20m
        sameLocIds.add(c1.clientCode || c1.id);
        sameLocIds.add(c2.clientCode || c2.id);
      }
    }
  }
  return sameLocIds;
};

// Count Nearby Pairs (Default 0.02km - thresholdKm) - Optimized Sort & Sweep
// Returns count of PAIRS (or unique customers involved? The original code counted unique IDs, so we return size of Set)
export const countNearbyCustomers = (customers: Customer[], thresholdKm: number = 0.3): number => {
  const nearbyIds = new Set<string>();
  const validCustomers = customers.filter(c => c.lat !== 0 && c.lng !== 0 && !isNaN(c.lat) && !isNaN(c.lng));

  if (validCustomers.length < 2) return 0;
  if (validCustomers.length > 5000) return 0; // Safety cap for extreme cases

  // 1. Sort by Latitude
  validCustomers.sort((a, b) => a.lat - b.lat);

  // 2. Sweep
  const LAT_WINDOW_DEG = thresholdKm * 0.01; // Approx conversion (rough but faster than full Distance each time)

  for (let i = 0; i < validCustomers.length; i++) {
    const c1 = validCustomers[i];

    for (let j = i + 1; j < validCustomers.length; j++) {
      const c2 = validCustomers[j];

      if (c2.lat - c1.lat > LAT_WINDOW_DEG) break;
      if (Math.abs(c1.lng - c2.lng) > LAT_WINDOW_DEG) continue;

      const dist = calculateDistance(c1.lat, c1.lng, c2.lat, c2.lng);
      if (dist > 0.02 && dist < thresholdKm) {
        nearbyIds.add(c1.id);
        nearbyIds.add(c2.id);
      }
    }
  }

  return nearbyIds.size;
};

// Analyze Sequence Gap for High Distance Legs
export const analyzeSequenceGap = (
  target: Customer,
  allCustomers: Customer[]
): { type: 'MOVE_DAY' | 'SWAP_ROUTE', detail: string } | null => {

  if (!target.regionDescription) return null;
  if (!target.lat || !target.lng) return null;

  // Filter context: Same Region only
  const regionPeers = allCustomers.filter(c =>
    c.id !== target.id &&
    c.regionDescription === target.regionDescription &&
    c.lat && c.lng
  );

  let bestNeighbor: Customer | null = null;
  let minDistance = Infinity;

  // Find absolute nearest neighbor in the region
  for (const peer of regionPeers) {
    // Quick bounding box check
    if (Math.abs(target.lat - peer.lat) > 0.1 || Math.abs(target.lng - peer.lng) > 0.1) continue;

    const dist = calculateDistance(target.lat, target.lng, peer.lat, peer.lng);
    if (dist < minDistance) {
      minDistance = dist;
      bestNeighbor = peer;
    }
  }

  // Logic: If we found a neighbor much closer (less than 1km)
  if (bestNeighbor && minDistance < 1.0) {

    // 1. Same Route, Different Day?
    if (bestNeighbor.routeName === target.routeName) {
      if (bestNeighbor.day !== target.day) {
        return {
          type: 'MOVE_DAY',
          detail: `Route visits nearby neighbor (${bestNeighbor.name}) on ${bestNeighbor.day}. Move to that day.`
        };
      }
    }
    // 2. Different Route?
    else {
      return {
        type: 'SWAP_ROUTE',
        detail: `Route '${bestNeighbor.routeName}' visits nearby neighbor (${bestNeighbor.name}). Transfer customer.`
      };
    }
  }

  return null;
};

// Simple Nearest Neighbor heuristic for TSP
export const optimizeRoute = (customers: Customer[], startCustomerId?: string, config: Partial<OptimizerConfig> = {}): { orderedCustomers: Customer[], summary: RouteSummary } => {
  const {
    serviceTimeMin = SERVICE_TIME_MIN,
    drivingDistanceFactor = DRIVING_DISTANCE_FACTOR,
    costObjective = 'BALANCED',
    startLocation,
    breakTimeMin = 0
  } = config;

  const validCustomers = customers.filter(c =>
    c && typeof c.lat === 'number' && !isNaN(c.lat) && isFinite(c.lat) && c.lat !== 0 &&
    typeof c.lng === 'number' && !isNaN(c.lng) && isFinite(c.lng) && c.lng !== 0
  );

  if (validCustomers.length < 2) {
    return {
      orderedCustomers: validCustomers,
      summary: { totalDistanceKm: 0, totalTimeMin: 0, stopCount: validCustomers.length, segments: [] }
    };
  }

  let startNodeIndex = 0;

  // 1. Logic: Determine Start Node
  // Priority: Explicit startCustomerId > DEPOT/HOME Setting > Default (0)
  if (startCustomerId) {
    const foundIndex = validCustomers.findIndex(c => c.id === startCustomerId);
    if (foundIndex !== -1) {
      startNodeIndex = foundIndex;
    }
  } else if (startLocation === 'DEPOT') {
    // Try to find a customer explicitly named "Depot" or with clientCode "DEPOT"
    const depotIndex = validCustomers.findIndex(c =>
      (c.clientCode && c.clientCode.toUpperCase() === 'DEPOT') ||
      (c.name && c.name.toUpperCase().includes('DEPOT'))
    );
    if (depotIndex !== -1) startNodeIndex = depotIndex;
  }
  // If startLocation is 'HOME', we currently default to the first customer as we don't have driver home coordinates.


  const startNode = validCustomers[startNodeIndex];
  const unvisited = [...validCustomers];
  unvisited.splice(startNodeIndex, 1);

  const path: Customer[] = [startNode];
  let current = startNode;
  let loopSafety = 0;
  const maxLoops = validCustomers.length * 2;

  while (unvisited.length > 0 && loopSafety < maxLoops) {
    loopSafety++;
    let nearestIndex = -1;
    let minCost = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      // Bounding box optimization
      if (Math.abs(current.lat - unvisited[i].lat) > 0.5 || Math.abs(current.lng - unvisited[i].lng) > 0.5) continue;

      const dist = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);

      // 2. Logic: Cost Objective
      let cost = dist;
      if (costObjective === 'TIME') {
        cost = calculateTime(dist, config);
      } else if (costObjective === 'BALANCED') {
        // Balanced: 70% Distance, 30% Time (Normalized roughly)
        // Since time is roughly dist * 2 (at 30km/h), 
        cost = dist * 0.7 + (calculateTime(dist, config) / 60) * 30 * 0.3;
      }

      if (cost < minCost) {
        minCost = cost;
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1 && unvisited.length > 0) nearestIndex = 0;

    if (nearestIndex !== -1) {
      const nextNode = unvisited[nearestIndex];
      path.push(nextNode);
      current = nextNode;
      unvisited.splice(nearestIndex, 1);
    } else {
      break;
    }
  }

  const segments: RouteSegment[] = [];
  let totalDistance = 0;
  let totalTravelTime = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const rawDist = calculateDistance(from.lat, from.lng, to.lat, to.lng);
    const isSameLocation = rawDist < 0.05;

    const drivingDist = isSameLocation ? 0 : rawDist * drivingDistanceFactor;
    const travelTime = isSameLocation ? 0 : calculateTime(drivingDist, config);

    segments.push({
      fromId: from.id,
      toId: to.id,
      distanceKm: parseFloat(drivingDist.toFixed(2)),
      estimatedTimeMin: parseFloat(travelTime.toFixed(1))
    });

    totalDistance += drivingDist;
    totalTravelTime += travelTime;
  }

  const totalServiceTime = (path.length - 1) * serviceTimeMin;

  // 3. Logic: Break Time
  // Add break time if route is substantial (e.g. > 4 hours or > 10 stops)
  const baseTotalTime = totalTravelTime + totalServiceTime;
  const applicableBreakTime = (baseTotalTime > 240 || path.length > 10) ? breakTimeMin : 0;

  return {
    orderedCustomers: path,
    summary: {
      totalDistanceKm: parseFloat(totalDistance.toFixed(2)),
      totalTimeMin: Math.round(baseTotalTime + applicableBreakTime),
      stopCount: path.length,
      segments
    }
  };
};

// --- QUICK AUDIT (Synchronous, Lightweight) ---
// Used for AI Context to estimate potential without running full genetic algo
export const quickRouteAudit = (customers: Customer[]): { potentialSavingsKm: number, isolatedCount: number } => {
  let potentialSavingsKm = 0;
  let isolatedCount = 0;

  const valid = customers.filter(c => c.lat && c.lng && c.routeName);

  // Group by Route
  const routeGroups = new Map<string, Customer[]>();
  valid.forEach(c => {
    if (!routeGroups.has(c.routeName!)) routeGroups.set(c.routeName!, []);
    routeGroups.get(c.routeName!)!.push(c);
  });

  // Calculate approximate centroids
  const routeCentroids = new Map<string, { lat: number, lng: number }>();
  routeGroups.forEach((group, route) => {
    const latSum = group.reduce((sum, c) => sum + c.lat, 0);
    const lngSum = group.reduce((sum, c) => sum + c.lng, 0);
    routeCentroids.set(route, { lat: latSum / group.length, lng: lngSum / group.length });
  });

  // Check for outliers
  valid.forEach(c => {
    const myRouteCenter = routeCentroids.get(c.routeName!);
    if (!myRouteCenter) return;

    const distToMyCenter = calculateDistance(c.lat, c.lng, myRouteCenter.lat, myRouteCenter.lng);

    // If far from own center (> 5km), check if closer to another route
    if (distToMyCenter > 5) {
      let bestOtherDist = Infinity;

      routeCentroids.forEach((center, route) => {
        if (route === c.routeName) return;
        const d = calculateDistance(c.lat, c.lng, center.lat, center.lng);
        if (d < bestOtherDist) bestOtherDist = d;
      });

      if (bestOtherDist < distToMyCenter * 0.7) { // 30% closer to someone else
        isolatedCount++;
        potentialSavingsKm += (distToMyCenter - bestOtherDist);
      }
    }
  });

  return {
    potentialSavingsKm: Math.round(potentialSavingsKm),
    isolatedCount
  };
};

// --- BRUTE FORCE AGGRESSIVE OPTIMIZER (ASYNC) ---
export const analyzeCrossRouteOptimizationAsync = async (
  customers: Customer[],
  onProgress?: (percentage: number) => void
): Promise<AISuggestion[]> => {

  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

  const regionMap = new Map<string, Customer[]>();
  const validCustomers = customers.filter(c =>
    c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0 && c.lng !== 0 &&
    c.routeName && c.regionDescription
  );

  validCustomers.forEach(c => {
    const region = c.regionDescription!;
    if (!regionMap.has(region)) regionMap.set(region, []);
    regionMap.get(region)!.push(c);
  });

  const suggestions: AISuggestion[] = [];
  let processedCount = 0;
  const totalCount = validCustomers.length;

  for (const [regionName, regionCustomers] of regionMap.entries()) {

    if (regionCustomers.length < 2) continue;

    for (let i = 0; i < regionCustomers.length; i++) {
      const target = regionCustomers[i];

      processedCount++;
      if (processedCount % 50 === 0) {
        if (onProgress) onProgress(Math.round((processedCount / totalCount) * 100));
        await yieldToMain();
      }

      const currentRouteName = target.routeName!;

      let distCurrentNeighbor = Infinity;
      let nearestCurrentPeer: Customer | null = null;

      let distBestAlternative = Infinity;
      let nearestAlternativePeer: Customer | null = null;
      let alternativeRouteName = '';

      for (const peer of regionCustomers) {
        if (peer.id === target.id) continue;

        if (Math.abs(target.lat - peer.lat) > 1.0 || Math.abs(target.lng - peer.lng) > 1.0) continue;

        const d = calculateDistance(target.lat, target.lng, peer.lat, peer.lng);

        if (peer.routeName === currentRouteName) {
          if (d < distCurrentNeighbor) {
            distCurrentNeighbor = d;
            nearestCurrentPeer = peer;
          }
        } else {
          if (d < distBestAlternative) {
            distBestAlternative = d;
            nearestAlternativePeer = peer;
            alternativeRouteName = peer.routeName!;
          }
        }
      }

      if (nearestAlternativePeer && alternativeRouteName) {
        const currentScore = distCurrentNeighbor === Infinity ? 9999 : distCurrentNeighbor;

        if (distBestAlternative < currentScore) {

          const distSaved = currentScore - distBestAlternative;
          const displaySaved = distCurrentNeighbor === Infinity ? "Fixes Isolation" : `${distSaved.toFixed(3)} km`;

          suggestions.push({
            id: `opt-${target.id}-${alternativeRouteName}`,
            type: 'MOVE_ROUTE',
            customer: target,
            currentRoute: currentRouteName,
            targetRoute: alternativeRouteName,
            reason: `Closer neighbor found in ${alternativeRouteName} (${distBestAlternative.toFixed(2)}km) vs ${currentRouteName} (${distCurrentNeighbor === Infinity ? 'Isolated' : distCurrentNeighbor.toFixed(2) + 'km'}).`,
            saving: `Save ${displaySaved}`,

            currentCentroid: nearestCurrentPeer
              ? { lat: nearestCurrentPeer.lat, lng: nearestCurrentPeer.lng }
              : { lat: target.lat, lng: target.lng },
            targetCentroid: { lat: nearestAlternativePeer.lat, lng: nearestAlternativePeer.lng },

            distToCurrent: parseFloat((distCurrentNeighbor === Infinity ? 0 : distCurrentNeighbor).toFixed(3)),
            distToTarget: parseFloat(distBestAlternative.toFixed(3)),
            suggestedDay: nearestAlternativePeer.day,
            nearbyTargetNeighbors: [nearestAlternativePeer]
          });
        }
      }
    }
  }

  if (onProgress) onProgress(100);

  return suggestions.sort((a, b) => {
    const savingA = (a.distToCurrent === 0 ? 100 : a.distToCurrent) - a.distToTarget;
    const savingB = (b.distToCurrent === 0 ? 100 : b.distToCurrent) - b.distToTarget;
    return savingB - savingA;
  });
};
