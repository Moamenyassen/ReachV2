/* eslint-disable no-restricted-globals */
// cleaning.worker.ts

// 1. Definition of the Data Record Interface
interface CleanRecord {
    id: string;
    name: string;
    lat: number;
    lng: number;
    region_description: string;
    [key: string]: any;
}

interface WorkerMessage {
    type: 'START_CLEANING';
    data: CleanRecord[];
}

interface ScanResult {
    stats: {
        totalScanned: number;
        normalized: number;
        duplicatesFound: number;
    };
    duplicatesGroups: string[][];
    normalizedRecords: { id: string; field: string; oldValue: string; newValue: string }[];
}

// 2. Normalization Dictionary
const CITY_MAP: Record<string, string> = {
    'jedda': 'Jeddah',
    'jeddah consumer': 'Jeddah',
    'jeddah-consumer': 'Jeddah',
    'ryadh': 'Riyadh',
    'riyadh consumer': 'Riyadh',
    'dammad': 'Dammam',
    'dammam consumer': 'Dammam',
    'khobar': 'Al Khobar',
    'alkhobar': 'Al Khobar',
    'makkah region': 'Makkah',
    'makkah consumer': 'Makkah',
    'madina': 'Madinah',
    'medina': 'Madinah',
    'taif consumer': 'Taif'
};

// 3. Helper: Haversine Distance (in Meters)
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in meters
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// 4. Helper: Levenshtein Distance
function levenshteinDistance(a: string, b: string): number {
    if (!a || !b) return 100;
    // Optimization: Early exit if length difference is too big
    if (Math.abs(a.length - b.length) > 3) return 100;

    const matrix = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// 5. Main Logic
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    if (e.data.type === 'START_CLEANING') {
        const rawData = e.data.data;
        const totalScanned = rawData.length;
        let normalizedCount = 0;
        const normalizedRecords: any[] = [];
        const duplicatesGroups: string[][] = [];

        // Track processed IDs to avoid double counting in pairs
        const processedForDupes = new Set<string>();

        // Report Start
        self.postMessage({ type: 'PROGRESS', progress: 0 });

        // A. Normalization Pass (Fast)
        const cleanedData = rawData.map(record => {
            let r = { ...record };
            const cityKey = (r.region_description || '').toLowerCase().trim();

            if (CITY_MAP[cityKey]) {
                const standardCity = CITY_MAP[cityKey];
                if (r.region_description !== standardCity) {
                    normalizedRecords.push({
                        id: r.id,
                        field: 'region_description',
                        oldValue: r.region_description,
                        newValue: standardCity
                    });
                    r.region_description = standardCity;
                    normalizedCount++;
                }
            }
            return r;
        });

        // B. Duplicate Detection (The "Ghost" Finder)
        // Optimization 1: Sort by Latitude THEN Longitude to cluster spatially
        cleanedData.sort((a, b) => {
            if (a.lat !== b.lat) return a.lat - b.lat;
            return a.lng - b.lng;
        });

        const reportProgressEvery = Math.max(100, Math.floor(cleanedData.length / 50));

        // Skip 0,0 items for duplicate check if they are obviously bad data (optional, but good for performance)
        // However, user might want to merge them. Let's process them but safely.

        for (let i = 0; i < cleanedData.length; i++) {
            // Periodic Progress Report
            if (i % reportProgressEvery === 0) {
                self.postMessage({ type: 'PROGRESS', progress: Math.round((i / cleanedData.length) * 100) });
            }

            if (processedForDupes.has(cleanedData[i].id)) continue;

            const currentGroup = [cleanedData[i].id];
            const recA = cleanedData[i];

            // Scan forward until lat difference is too big (> 0.001 deg ~ 111m) 
            // User asked for 20m, so 0.0005 deg safety margin is enough.
            for (let j = i + 1; j < cleanedData.length; j++) {
                if (processedForDupes.has(cleanedData[j].id)) continue;

                const recB = cleanedData[j];
                const latDiff = Math.abs(recB.lat - recA.lat);

                if (latDiff > 0.001) break; // Optimization break - outside lat window entirely

                // Optimization: If Lat is extremely close (or identical), check Lng diff before trig
                // Since we sorted by Lng as secondary, if Lng diff is big, we can break IF we assume monotonic increase,
                // BUT secondary sort is only local to same Lat.
                // However, if Lat is identical, Lng is sorted.
                if (recA.lat === recB.lat) {
                    if (Math.abs(recB.lng - recA.lng) > 0.001) {
                        // Different longitude, same latitude (very far apart E-W).
                        // Since we sort by Lng for same Lat, all subsequent records will be even further East.
                        // So we can breal inner loop? 
                        // NO, because next record might have slightly higher Lat but valid Lng.
                        // BUT for the *same* Lat block, yes we can break or continue.
                        // Let's just create a quick skip.
                        // Actually, this simple check below is fast enough.
                    }
                }

                // Condition A: Exact Match (Fastest)
                const isExactName = recA.name.length === recB.name.length && recA.name.trim().toLowerCase() === recB.name.trim().toLowerCase();
                const isExactCoords = Math.abs(recA.lat - recB.lat) < 0.00001 && Math.abs(recA.lng - recB.lng) < 0.00001;

                if (isExactName && isExactCoords) {
                    currentGroup.push(recB.id);
                    processedForDupes.add(recB.id);
                    continue;
                }

                // Condition B: Fuzzy Spatial Match (Heavier)
                // Distance < 20m
                const dist = getDistanceFromLatLonInMeters(recA.lat, recA.lng, recB.lat, recB.lng);
                if (dist < 20) {
                    // Check Name Similarity
                    // If names are short (<5 chars), require exact match. Else allow edit distance 2.
                    const nameLen = Math.max(recA.name.length, recB.name.length);
                    const threshold = nameLen < 5 ? 0 : 2;

                    // Optimization: Basic substring check first?
                    // if (!recA.name.toLowerCase().includes(recB.name.toLowerCase().substring(0,3))) ... 

                    const lev = levenshteinDistance(recA.name.toLowerCase(), recB.name.toLowerCase());
                    if (lev <= threshold) {
                        currentGroup.push(recB.id);
                        processedForDupes.add(recB.id);
                    }
                }
            }

            if (currentGroup.length > 1) {
                duplicatesGroups.push(currentGroup);
                processedForDupes.add(recA.id);
            }
        }

        // 6. Return Report
        const report: ScanResult = {
            stats: {
                totalScanned,
                normalized: normalizedCount,
                duplicatesFound: duplicatesGroups.reduce((acc, g) => acc + g.length, 0)
            },
            duplicatesGroups,
            normalizedRecords
        };

        // Send 'COMPLETE' message
        self.postMessage({ type: 'COMPLETE', report });
    }
};
