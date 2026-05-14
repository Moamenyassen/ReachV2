/**
 * Error Handling Utilities
 * 
 * Consistent error handling across the application
 */

// ==========================================
// ERROR TYPES
// ==========================================

export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    VALIDATION = 'VALIDATION',
    NOT_FOUND = 'NOT_FOUND',
    PERMISSION = 'PERMISSION',
    RATE_LIMIT = 'RATE_LIMIT',
    SERVER = 'SERVER',
    UNKNOWN = 'UNKNOWN'
}

export interface AppError {
    type: ErrorType;
    message: string;
    code?: string;
    details?: any;
    retryable: boolean;
}

// ==========================================
// ERROR PARSING
// ==========================================

/**
 * Parse Supabase errors into consistent AppError format
 */
export const parseSupabaseError = (error: any): AppError => {
    const message = error?.message || 'An unexpected error occurred';
    const code = error?.code || error?.status;

    // Auth errors
    if (message.includes('Invalid login credentials')) {
        return { type: ErrorType.AUTH, message: 'Invalid email or password', code, retryable: true };
    }
    if (message.includes('Email not confirmed')) {
        return { type: ErrorType.AUTH, message: 'Please confirm your email before signing in', code, retryable: false };
    }
    if (message.includes('User already registered')) {
        return { type: ErrorType.AUTH, message: 'An account with this email already exists', code, retryable: false };
    }
    if (code === 'PGRST301' || message.includes('JWT')) {
        return { type: ErrorType.AUTH, message: 'Your session has expired. Please sign in again.', code, retryable: false };
    }

    // Permission errors
    if (code === '42501' || message.includes('permission denied')) {
        return { type: ErrorType.PERMISSION, message: 'You do not have permission to perform this action', code, retryable: false };
    }

    // Not found errors
    if (code === 'PGRST116' || message.includes('not found')) {
        return { type: ErrorType.NOT_FOUND, message: 'The requested resource was not found', code, retryable: false };
    }

    // Rate limit errors
    if (code === 429 || message.includes('rate limit')) {
        return { type: ErrorType.RATE_LIMIT, message: 'Too many requests. Please wait a moment.', code, retryable: true };
    }

    // Network errors
    if (message.includes('Failed to fetch') || message.includes('network')) {
        return { type: ErrorType.NETWORK, message: 'Unable to connect. Check your internet connection.', code, retryable: true };
    }

    // Server errors
    if (code >= 500) {
        return { type: ErrorType.SERVER, message: 'Server error. Please try again later.', code, retryable: true };
    }

    return { type: ErrorType.UNKNOWN, message, code, retryable: false };
};

// ==========================================
// USER-FRIENDLY MESSAGES
// ==========================================

const ERROR_MESSAGES: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: 'Unable to connect. Please check your internet connection.',
    [ErrorType.AUTH]: 'Authentication failed. Please try again.',
    [ErrorType.VALIDATION]: 'Please check your input and try again.',
    [ErrorType.NOT_FOUND]: 'The requested item was not found.',
    [ErrorType.PERMISSION]: 'You do not have permission to perform this action.',
    [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment.',
    [ErrorType.SERVER]: 'Server error. Please try again later.',
    [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

export const getErrorMessage = (error: AppError | any): string => {
    if (error?.type && error?.message) {
        return error.message;
    }

    const parsed = parseSupabaseError(error);
    return parsed.message;
};

// ==========================================
// ERROR LOGGING
// ==========================================

/**
 * Log error for debugging (strips sensitive data)
 */
export const logError = (error: any, context?: string): void => {
    const sanitized = {
        message: error?.message,
        code: error?.code,
        context,
        timestamp: new Date().toISOString()
    };

    console.error('[Reach Error]', sanitized);

    // In production, you might send this to an error tracking service
    // e.g., Sentry, LogRocket, etc.
};

// ==========================================
// TRY-CATCH WRAPPER
// ==========================================

/**
 * Wrapper for async functions with consistent error handling
 */
export const tryCatch = async <T>(
    fn: () => Promise<T>,
    context?: string
): Promise<[T | null, AppError | null]> => {
    try {
        const result = await fn();
        return [result, null];
    } catch (error: any) {
        logError(error, context);
        const appError = parseSupabaseError(error);
        return [null, appError];
    }
};

/**
 * React hook-friendly error wrapper
 * Returns { data, error, loading } pattern
 */
export interface AsyncResult<T> {
    data: T | null;
    error: AppError | null;
    loading: boolean;
}

// ==========================================
// TOAST NOTIFICATION HELPER
// ==========================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    type: ToastType;
    title: string;
    message: string;
    duration?: number;
}

export const createErrorToast = (error: any): ToastMessage => {
    const appError = parseSupabaseError(error);
    return {
        type: 'error',
        title: appError.type === ErrorType.AUTH ? 'Authentication Error' : 'Error',
        message: appError.message,
        duration: appError.retryable ? 5000 : 8000
    };
};

export const createSuccessToast = (message: string): ToastMessage => ({
    type: 'success',
    title: 'Success',
    message,
    duration: 3000
});
