
import { Customer } from '../types';

// Types for your Dashboard Data
export interface DashboardKPIs {
    totalCustomers: number;
    activeRoutes: number;
    totalVisits: number;
    totalDistance: number;
    totalTime: number;
    avgVisitsPerRoute: number;
    timePerUser: number;
    frequency: number;
    efficiency: number;
}

export interface RouteHealthStats {
    stable: number;
    under: number;
    over: number;
    total?: number;
    details?: any[];
}

export interface DashboardAlerts {
    missingGps: number;
    proximityIssues: number;
}

export interface DashboardSummary {
    kpis: DashboardKPIs;
    routeHealth: RouteHealthStats;
    alerts: DashboardAlerts;
    activeBranches?: string[];
    dailyDistinct?: Array<{ day: string, count: number }>;
}


// SIMULATED SERVER DELAY - Reduced for performance (200ms)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms / 4));

export const MockAnalyticsService = {

    getSummary: async (filters: any): Promise<DashboardSummary> => {
        await delay(200); // Fast response

        // Mock Data Response matching the User Request structure
        return {
            kpis: {
                totalCustomers: 10689,
                activeRoutes: 98,
                totalVisits: 44358,
                totalDistance: 100494.8,
                totalTime: 1004460, // 16741 hours in minutes
                avgVisitsPerRoute: 452.6,
                timePerUser: 10245,
                frequency: 4.1,
                efficiency: 77
            },
            routeHealth: {
                stable: 54,
                under: 11,
                over: 33,
                total: 98,
                details: [
                    { routeName: 'RiyadhCentral-01', branchName: 'Riyadh Main', distinctCustomers: 42, region: 'Central', status: 'stable', efficiency: '92%' },
                    { routeName: 'JeddahWest-04', branchName: 'Jeddah Hub', distinctCustomers: 28, region: 'Western', status: 'under', efficiency: '64%' },
                    { routeName: 'DammamEast-02', branchName: 'Dammam', distinctCustomers: 55, region: 'Eastern', status: 'over', efficiency: '78%' },
                    { routeName: 'AbhaSouth-01', branchName: 'Abha', distinctCustomers: 35, region: 'Southern', status: 'stable', efficiency: '88%' },
                    { routeName: 'MedinaNorth-03', branchName: 'Medina', distinctCustomers: 12, region: 'Northern', status: 'under', efficiency: '45%' },
                    { routeName: 'TabukNorth-02', branchName: 'Tabuk', distinctCustomers: 48, region: 'Northern', status: 'over', efficiency: '72%' },
                    { routeName: 'QassimCentral-05', branchName: 'Qassim', distinctCustomers: 38, region: 'Central', status: 'stable', efficiency: '95%' },
                    { routeName: 'HailNorth-01', branchName: 'Hail', distinctCustomers: 22, region: 'Northern', status: 'under', efficiency: '58%' },
                ]
            },
            alerts: {
                missingGps: 842,
                proximityIssues: 615
            },
            activeBranches: ['Riyadh Main', 'Jeddah North', 'Dammam Hub', 'Abha Branch'],
            dailyDistinct: [ // RESTORED DAILY DISTINCT DATA
                { day: 'Sun', count: 8540 },
                { day: 'Mon', count: 9230 },
                { day: 'Tue', count: 8900 },
                { day: 'Wed', count: 9100 },
                { day: 'Thu', count: 8600 },
                { day: 'Fri', count: 4200 },
                { day: 'Sat', count: 5100 },
            ]
        };
    },

};
