export const CURRENCY_CONFIG: Record<string, { code: string, symbol: string, rate: number, name: string }> = {
    'SA': { code: 'SAR', symbol: 'SAR', rate: 1, name: 'Saudi Riyal' }, // Base Currency
    'US': { code: 'USD', symbol: '$', rate: 0.266, name: 'US Dollar' },
    'AE': { code: 'AED', symbol: 'AED', rate: 0.98, name: 'UAE Dirham' },
    'EG': { code: 'EGP', symbol: 'EGP', rate: 12.9, name: 'Egyptian Pound' }, // Approximate
};

export const DEFAULT_CURRENCY = CURRENCY_CONFIG['SA'];

export const getCurrencyForCountry = (countryCode?: string) => {
    if (!countryCode) return DEFAULT_CURRENCY;
    const upper = countryCode.toUpperCase();
    return CURRENCY_CONFIG[upper] || DEFAULT_CURRENCY;
};

export const detectUserCountry = (): string => {
    // Simple heuristic based on timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Riyadh')) return 'SA';
    if (tz.includes('Dubai')) return 'AE';
    if (tz.includes('Cairo')) return 'EG';
    if (tz.includes('New_York') || tz.includes('Los_Angeles')) return 'US';
    return 'SA'; // Default to SA as requested
};

export const formatPrice = (amountInSar: number, targetCountryCode?: string) => {
    const currency = getCurrencyForCountry(targetCountryCode);
    const converted = amountInSar * currency.rate;

    // Formatting
    return {
        value: converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        symbol: currency.symbol,
        code: currency.code
    };
};
