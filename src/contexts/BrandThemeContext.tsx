import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface BrandTheme {
    id: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoUrl: string;
    faviconUrl: string;
    fontFamily: string;
    companyName: string;
}

export type ThemePreset = 'modern' | 'classic' | 'custom';

interface BrandThemeContextType {
    theme: BrandTheme;
    activePreset: ThemePreset;
    setTheme: (theme: Partial<BrandTheme>) => void;
    setPreset: (preset: ThemePreset) => void;
    applyCustomTheme: (theme: Partial<BrandTheme>) => void;
    revertToDefault: () => void;
}

// ============================================================================
// PRESET THEMES
// ============================================================================

export const THEME_PRESETS: Record<ThemePreset, BrandTheme> = {
    modern: {
        id: 'modern',
        name: 'Modern',
        primaryColor: '#06B6D4', // Cyan
        secondaryColor: '#7C3AED', // Violet
        accentColor: '#10B981', // Emerald
        logoUrl: '',
        faviconUrl: '',
        fontFamily: 'Inter',
        companyName: 'Reach AI'
    },
    classic: {
        id: 'classic',
        name: 'Classic',
        primaryColor: '#3B82F6', // Blue
        secondaryColor: '#64748B', // Slate
        accentColor: '#F59E0B', // Amber
        logoUrl: '',
        faviconUrl: '',
        fontFamily: 'Inter',
        companyName: 'Reach AI'
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        primaryColor: '#06B6D4',
        secondaryColor: '#7C3AED',
        accentColor: '#10B981',
        logoUrl: '',
        faviconUrl: '',
        fontFamily: 'Inter',
        companyName: 'Reach AI'
    }
};

const STORAGE_KEY = 'rg_v2_brand_theme';
const PRESET_KEY = 'rg_v2_brand_preset';

// ============================================================================
// CONTEXT
// ============================================================================

const BrandThemeContext = createContext<BrandThemeContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export const BrandThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize from localStorage or default to modern preset
    const [activePreset, setActivePreset] = useState<ThemePreset>(() => {
        try {
            const saved = localStorage.getItem(PRESET_KEY);
            return (saved as ThemePreset) || 'modern';
        } catch {
            return 'modern';
        }
    });

    const [theme, setThemeState] = useState<BrandTheme>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
            return THEME_PRESETS.modern;
        } catch {
            return THEME_PRESETS.modern;
        }
    });

    // Apply CSS variables whenever theme changes
    useEffect(() => {
        const root = document.documentElement;

        // Set CSS custom properties
        root.style.setProperty('--brand-primary', theme.primaryColor);
        root.style.setProperty('--brand-secondary', theme.secondaryColor);
        root.style.setProperty('--brand-accent', theme.accentColor);
        root.style.setProperty('--brand-font', theme.fontFamily);

        // Also set RGB variants for opacity support
        const hexToRgb = (hex: string): string => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (result) {
                return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
            }
            return '6, 182, 212'; // Default cyan
        };

        root.style.setProperty('--brand-primary-rgb', hexToRgb(theme.primaryColor));
        root.style.setProperty('--brand-secondary-rgb', hexToRgb(theme.secondaryColor));
        root.style.setProperty('--brand-accent-rgb', hexToRgb(theme.accentColor));

        // Persist to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
            localStorage.setItem(PRESET_KEY, activePreset);
        } catch (e) {
            console.warn('Failed to persist theme to localStorage', e);
        }
    }, [theme, activePreset]);

    // Set partial theme updates
    const setTheme = useCallback((updates: Partial<BrandTheme>) => {
        setThemeState(prev => ({ ...prev, ...updates }));
    }, []);

    // Switch to a preset theme
    const setPreset = useCallback((preset: ThemePreset) => {
        setActivePreset(preset);
        if (preset !== 'custom') {
            setThemeState(THEME_PRESETS[preset]);
        }
    }, []);

    // Apply a custom brand theme
    const applyCustomTheme = useCallback((customTheme: Partial<BrandTheme>) => {
        setActivePreset('custom');
        setThemeState(prev => ({
            ...prev,
            ...customTheme,
            id: 'custom',
            name: customTheme.companyName || 'Custom'
        }));
    }, []);

    // Revert to modern default
    const revertToDefault = useCallback(() => {
        setActivePreset('modern');
        setThemeState(THEME_PRESETS.modern);
    }, []);

    return (
        <BrandThemeContext.Provider value={{
            theme,
            activePreset,
            setTheme,
            setPreset,
            applyCustomTheme,
            revertToDefault
        }}>
            {children}
        </BrandThemeContext.Provider>
    );
};

// ============================================================================
// HOOK
// ============================================================================

export const useBrandTheme = (): BrandThemeContextType => {
    const context = useContext(BrandThemeContext);
    if (!context) {
        throw new Error('useBrandTheme must be used within a BrandThemeProvider');
    }
    return context;
};

export default BrandThemeContext;
