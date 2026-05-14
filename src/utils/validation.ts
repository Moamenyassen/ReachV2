/**
 * Input Validation & Sanitization Utilities
 * 
 * Use these functions to validate and sanitize user input
 * before sending to the database or API.
 */

// ==========================================
// EMAIL VALIDATION
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_REGEX.test(email.trim());
};

export const sanitizeEmail = (email: string): string => {
    if (!email) return '';
    return email.toLowerCase().trim();
};

// ==========================================
// PASSWORD VALIDATION
// ==========================================

export interface PasswordValidation {
    isValid: boolean;
    errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
    const errors: string[] = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain an uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain a lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain a number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// Simple validation (just length check)
export const isValidPasswordSimple = (password: string): boolean => {
    return password && password.length >= 6;
};

// ==========================================
// TEXT SANITIZATION
// ==========================================

/**
 * Sanitize text input to prevent XSS
 * Removes HTML tags and dangerous characters
 */
export const sanitizeText = (input: string): string => {
    if (!input || typeof input !== 'string') return '';

    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>]/g, '') // Remove stray angle brackets
        .trim();
};

/**
 * Sanitize for use in SQL or database
 * Note: This is a backup - always use parameterized queries
 */
export const sanitizeForDb = (input: string): string => {
    if (!input || typeof input !== 'string') return '';

    return input
        .replace(/'/g, "''") // Escape single quotes
        .replace(/\\/g, '\\\\') // Escape backslashes
        .trim();
};

// ==========================================
// PHONE VALIDATION
// ==========================================

const PHONE_REGEX = /^\+?[\d\s\-()]{8,20}$/;

export const isValidPhone = (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    return PHONE_REGEX.test(phone.trim());
};

export const sanitizePhone = (phone: string): string => {
    if (!phone) return '';
    // Keep only digits, +, and spaces
    return phone.replace(/[^\d+\s\-]/g, '').trim();
};

// ==========================================
// NAME VALIDATION
// ==========================================

export const isValidName = (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
};

export const sanitizeName = (name: string): string => {
    if (!name) return '';
    return sanitizeText(name).substring(0, 100);
};

// ==========================================
// URL VALIDATION
// ==========================================

export const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// ==========================================
// COORDINATES VALIDATION
// ==========================================

export const isValidLatitude = (lat: number): boolean => {
    return typeof lat === 'number' && lat >= -90 && lat <= 90;
};

export const isValidLongitude = (lng: number): boolean => {
    return typeof lng === 'number' && lng >= -180 && lng <= 180;
};

export const isValidCoordinates = (lat: number, lng: number): boolean => {
    return isValidLatitude(lat) && isValidLongitude(lng);
};

// ==========================================
// UUID VALIDATION
// ==========================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidUUID = (uuid: string): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    return UUID_REGEX.test(uuid);
};

// ==========================================
// FORM VALIDATION HELPER
// ==========================================

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
}

export const validateLoginForm = (email: string, password: string): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!email) {
        errors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
        errors.email = 'Invalid email format';
    }

    if (!password) {
        errors.password = 'Password is required';
    } else if (!isValidPasswordSimple(password)) {
        errors.password = 'Password must be at least 6 characters';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

export const validateRegistrationForm = (data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
}): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!data.email) {
        errors.email = 'Email is required';
    } else if (!isValidEmail(data.email)) {
        errors.email = 'Invalid email format';
    }

    if (!data.password) {
        errors.password = 'Password is required';
    } else {
        const pwValidation = validatePassword(data.password);
        if (!pwValidation.isValid) {
            errors.password = pwValidation.errors[0];
        }
    }

    if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
    }

    if (!data.firstName || !isValidName(data.firstName)) {
        errors.firstName = 'First name is required';
    }

    if (!data.lastName || !isValidName(data.lastName)) {
        errors.lastName = 'Last name is required';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// ==========================================
// CUSTOMER DATA VALIDATION
// ==========================================

export const validateCustomerData = (data: {
    name: string;
    lat: number;
    lng: number;
    clientCode?: string;
}): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!data.name || !isValidName(data.name)) {
        errors.name = 'Customer name is required';
    }

    if (!isValidLatitude(data.lat)) {
        errors.lat = 'Invalid latitude (must be -90 to 90)';
    }

    if (!isValidLongitude(data.lng)) {
        errors.lng = 'Invalid longitude (must be -180 to 180)';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
