/**
 * Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
    isValidEmail,
    sanitizeEmail,
    validatePassword,
    isValidPasswordSimple,
    sanitizeText,
    isValidPhone,
    sanitizePhone,
    isValidName,
    isValidUrl,
    isValidLatitude,
    isValidLongitude,
    isValidCoordinates,
    isValidUUID,
    validateLoginForm,
    validateRegistrationForm,
    validateCustomerData
} from '../utils/validation';

describe('Email Validation', () => {
    it('should validate correct emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        expect(isValidEmail('admin@company.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('notanemail')).toBe(false);
        expect(isValidEmail('missing@domain')).toBe(false);
        expect(isValidEmail('@nodomain.com')).toBe(false);
    });

    it('should sanitize emails', () => {
        expect(sanitizeEmail('  Test@EXAMPLE.com  ')).toBe('test@example.com');
        expect(sanitizeEmail('')).toBe('');
    });
});

describe('Password Validation', () => {
    it('should validate strong passwords', () => {
        const result = validatePassword('SecurePass123');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
        const result = validatePassword('weak');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate simple passwords', () => {
        expect(isValidPasswordSimple('123456')).toBe(true);
        expect(isValidPasswordSimple('12345')).toBe(false);
    });
});

describe('Text Sanitization', () => {
    it('should remove HTML tags', () => {
        expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
        expect(sanitizeText('<div>Hello</div>')).toBe('Hello');
    });

    it('should handle empty input', () => {
        expect(sanitizeText('')).toBe('');
        expect(sanitizeText(null as any)).toBe('');
    });
});

describe('Phone Validation', () => {
    it('should validate phone numbers', () => {
        expect(isValidPhone('+1 234 567 8900')).toBe(true);
        expect(isValidPhone('+966501234567')).toBe(true);
        expect(isValidPhone('(555) 123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone('123')).toBe(false);
    });

    it('should sanitize phone numbers', () => {
        expect(sanitizePhone('+1 (234) 567-8900')).toBe('+1 234 567-8900');
    });
});

describe('Coordinate Validation', () => {
    it('should validate latitude', () => {
        expect(isValidLatitude(0)).toBe(true);
        expect(isValidLatitude(45.5)).toBe(true);
        expect(isValidLatitude(-90)).toBe(true);
        expect(isValidLatitude(90)).toBe(true);
        expect(isValidLatitude(91)).toBe(false);
        expect(isValidLatitude(-91)).toBe(false);
    });

    it('should validate longitude', () => {
        expect(isValidLongitude(0)).toBe(true);
        expect(isValidLongitude(180)).toBe(true);
        expect(isValidLongitude(-180)).toBe(true);
        expect(isValidLongitude(181)).toBe(false);
    });

    it('should validate coordinate pairs', () => {
        expect(isValidCoordinates(24.7136, 46.6753)).toBe(true);
        expect(isValidCoordinates(91, 46.6753)).toBe(false);
    });
});

describe('UUID Validation', () => {
    it('should validate UUIDs', () => {
        expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(isValidUUID('not-a-uuid')).toBe(false);
        expect(isValidUUID('')).toBe(false);
    });
});

describe('Form Validation', () => {
    it('should validate login form', () => {
        const valid = validateLoginForm('test@example.com', '123456');
        expect(valid.isValid).toBe(true);

        const invalid = validateLoginForm('', '');
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors.email).toBeDefined();
        expect(invalid.errors.password).toBeDefined();
    });

    it('should validate registration form', () => {
        const valid = validateRegistrationForm({
            email: 'test@example.com',
            password: 'SecurePass123',
            confirmPassword: 'SecurePass123',
            firstName: 'John',
            lastName: 'Doe'
        });
        expect(valid.isValid).toBe(true);

        const invalid = validateRegistrationForm({
            email: 'invalid',
            password: 'weak',
            confirmPassword: 'different',
            firstName: '',
            lastName: ''
        });
        expect(invalid.isValid).toBe(false);
    });

    it('should validate customer data', () => {
        const valid = validateCustomerData({
            name: 'Customer ABC',
            lat: 24.7136,
            lng: 46.6753
        });
        expect(valid.isValid).toBe(true);

        const invalid = validateCustomerData({
            name: '',
            lat: 999,
            lng: 46
        });
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors.name).toBeDefined();
        expect(invalid.errors.lat).toBeDefined();
    });
});
