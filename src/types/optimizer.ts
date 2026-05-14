
export type OptimizationType = 'USER_SWAP' | 'DAY_SWAP' | 'USER_DAY_SWAP';

export interface OptimizationSuggestion {
    id: string;
    type: OptimizationType;
    clientCode: string;
    clientName: string;
    clientArabic?: string;
    district?: string;
    classification?: 'A' | 'B' | 'C';
    storeType?: string;
    latitude: number;
    longitude: number;

    from: {
        userCode: string;
        route: string;
        day: string;
        week: string;
    };

    to: {
        userCode: string;
        route: string;
        day: string;
        week: string;
    };

    impact: {
        distanceSaved: number;
        timeSaved: number;
        currentDistance: number;
        optimizedDistance: number;
        impactScore: number; // 0-100
        confidence: number; // 0-100
    };

    reason: string;
}

export interface OptimizationStats {
    totalSavingsKM: number;
    totalTimeSavedMin: number;
    optimizationCount: number;
}
