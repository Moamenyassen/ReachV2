/**
 * Frontend usage logger.
 * Best-effort fire-and-forget inserts; never blocks user flow.
 *
 * Tables: `gemini_usage_logs`, `market_scan_logs`, `system_error_log`
 *         (see db/migration_sysadmin_security_v1.sql)
 */
import { supabase } from './supabase';

type GeminiSurface = 'optimizer' | 'analyzer' | 'chat';

export async function logGeminiCall(args: {
    companyId?: string | null;
    userId?: string | null;
    surface: GeminiSurface;
    model: string;
    durationMs?: number;
    status?: 'success' | 'failure';
    errorMessage?: string;
}) {
    try {
        await supabase.from('gemini_usage_logs').insert({
            company_id: args.companyId ?? null,
            user_id: args.userId ?? null,
            surface: args.surface,
            model: args.model,
            duration_ms: args.durationMs ?? null,
            status: args.status ?? 'success',
            error_message: args.errorMessage ?? null,
        });
    } catch (e) {
        // swallow — telemetry must never break UX
        console.warn('[usageLogger] gemini log failed', e);
    }
}

export async function logMarketScan(args: {
    companyId: string;
    userId?: string | null;
    centerLat?: number;
    centerLng?: number;
    radiusMeters?: number;
    leadsFound: number;
    leadsSaved?: number;
    status?: 'success' | 'failure';
    errorMessage?: string;
}) {
    try {
        await supabase.from('market_scan_logs').insert({
            company_id: args.companyId,
            user_id: args.userId ?? null,
            center_lat: args.centerLat ?? null,
            center_lng: args.centerLng ?? null,
            radius_meters: args.radiusMeters ?? null,
            leads_found: args.leadsFound,
            leads_saved: args.leadsSaved ?? 0,
            status: args.status ?? 'success',
            error_message: args.errorMessage ?? null,
        });
    } catch (e) {
        console.warn('[usageLogger] scan log failed', e);
    }
}

export async function logFrontendError(args: {
    source: string;
    message: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    companyId?: string | null;
    userId?: string | null;
    stack?: string;
    metadata?: Record<string, any>;
}) {
    try {
        await supabase.from('system_error_log').insert({
            source: args.source,
            severity: args.severity ?? 'error',
            company_id: args.companyId ?? null,
            user_id: args.userId ?? null,
            message: args.message?.slice(0, 8000) ?? '',
            stack_trace: args.stack?.slice(0, 16000) ?? null,
            metadata: args.metadata ?? {},
        });
    } catch (e) {
        console.warn('[usageLogger] error log failed', e);
    }
}
