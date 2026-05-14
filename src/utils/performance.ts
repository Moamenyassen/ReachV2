/**
 * Performance Utilities
 * 
 * Hooks and utilities for optimizing data fetching and caching
 */

import { useCallback, useRef, useEffect, useState } from 'react';

// ==========================================
// DEBOUNCE HOOK
// ==========================================

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// ==========================================
// THROTTLE HOOK
// ==========================================

export function useThrottle<T>(value: T, limit: number): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastRan = useRef(Date.now());

    useEffect(() => {
        const handler = setTimeout(() => {
            if (Date.now() - lastRan.current >= limit) {
                setThrottledValue(value);
                lastRan.current = Date.now();
            }
        }, limit - (Date.now() - lastRan.current));

        return () => clearTimeout(handler);
    }, [value, limit]);

    return throttledValue;
}

// ==========================================
// MEMOIZED CALLBACK WITH CACHE
// ==========================================

interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

export function useCache<T>(ttl: number = 60000) {
    const cache = useRef<Map<string, CacheEntry<T>>>(new Map());

    const get = useCallback((key: string): T | undefined => {
        const entry = cache.current.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > ttl) {
            cache.current.delete(key);
            return undefined;
        }

        return entry.value;
    }, [ttl]);

    const set = useCallback((key: string, value: T) => {
        cache.current.set(key, { value, timestamp: Date.now() });
    }, []);

    const clear = useCallback(() => {
        cache.current.clear();
    }, []);

    const invalidate = useCallback((key: string) => {
        cache.current.delete(key);
    }, []);

    return { get, set, clear, invalidate };
}

// ==========================================
// FETCH WITH CACHE
// ==========================================

const globalCache = new Map<string, CacheEntry<any>>();

export async function cachedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 60000
): Promise<T> {
    const cached = globalCache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.value;
    }

    const value = await fetcher();
    globalCache.set(key, { value, timestamp: Date.now() });
    return value;
}

export function clearCache(key?: string): void {
    if (key) {
        globalCache.delete(key);
    } else {
        globalCache.clear();
    }
}

// ==========================================
// INTERSECTION OBSERVER HOOK (Lazy Loading)
// ==========================================

export function useIntersectionObserver(
    options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1, ...options }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [options]);

    return [ref, isVisible];
}

// ==========================================
// VIRTUAL SCROLLING HELPER
// ==========================================

interface VirtualScrollConfig {
    itemCount: number;
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
}

export function calculateVirtualScroll(
    scrollTop: number,
    config: VirtualScrollConfig
) {
    const { itemCount, itemHeight, containerHeight, overscan = 5 } = config;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        itemCount - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
        startIndex,
        endIndex,
        offsetY: startIndex * itemHeight,
        visibleCount: endIndex - startIndex + 1
    };
}

// ==========================================
// REQUEST DEDUPLICATION
// ==========================================

const pendingRequests = new Map<string, Promise<any>>();

export async function deduplicatedRequest<T>(
    key: string,
    fetcher: () => Promise<T>
): Promise<T> {
    // Check if there's already a pending request
    const pending = pendingRequests.get(key);
    if (pending) {
        return pending as Promise<T>;
    }

    // Create new request and store it
    const request = fetcher().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, request);
    return request;
}
