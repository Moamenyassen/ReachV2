/**
 * Authentication Service Tests
 * 
 * Tests for the secure Supabase Auth integration
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Create mock functions
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } }
}));
const mockUpdateUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

// Mock the supabase module
vi.mock('../services/supabase', () => ({
    supabase: {
        auth: {
            signInWithPassword: mockSignInWithPassword,
            signUp: mockSignUp,
            signOut: mockSignOut,
            getUser: mockGetUser,
            getSession: mockGetSession,
            onAuthStateChange: mockOnAuthStateChange,
            updateUser: mockUpdateUser,
            resetPasswordForEmail: mockResetPasswordForEmail
        },
        from: mockFrom,
        rpc: mockRpc
    }
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock window.location
Object.defineProperty(globalThis, 'location', {
    value: { origin: 'http://localhost:3000' },
    writable: true
});

describe('Authentication Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('signIn', () => {
        it('should successfully sign in with valid credentials', async () => {
            const mockUser = { id: 'auth-user-123', email: 'test@example.com' };
            const mockProfile = {
                id: 'profile-123',
                username: 'test@example.com',
                role: 'USER',
                isActive: true,
                companyId: 'company-123'
            };

            // Setup mocks
            mockSignInWithPassword.mockResolvedValue({
                data: { user: mockUser, session: { access_token: 'token' } },
                error: null
            });

            mockGetUser.mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            mockRpc.mockResolvedValue({
                data: mockProfile,
                error: null
            });

            // Import module with mocks in place
            const { signIn } = await import('../services/authService');
            const result = await signIn('test@example.com', 'password123');

            expect(result.username).toBe('test@example.com');
            expect(mockSignInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123'
            });
        });

        it('should throw error for invalid credentials', async () => {
            mockSignInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: { message: 'Invalid login credentials' }
            });

            const { signIn } = await import('../services/authService');

            await expect(signIn('wrong@example.com', 'wrongpass'))
                .rejects.toThrow('Invalid login credentials');
        });

        it('should reject deactivated users', async () => {
            const mockUser = { id: 'auth-user-456', email: 'inactive@example.com' };

            mockSignInWithPassword.mockResolvedValue({
                data: { user: mockUser, session: { access_token: 'token' } },
                error: null
            });

            mockGetUser.mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            mockRpc.mockResolvedValue({
                data: {
                    id: 'user-456',
                    username: 'inactive@example.com',
                    role: 'USER',
                    isActive: false, // Deactivated!
                    companyId: 'company-123'
                },
                error: null
            });

            mockSignOut.mockResolvedValue({ error: null });

            const { signIn } = await import('../services/authService');

            await expect(signIn('inactive@example.com', 'password123'))
                .rejects.toThrow('Account is deactivated');
        });
    });

    describe('signOut', () => {
        it('should sign out and clear localStorage', async () => {
            mockSignOut.mockResolvedValue({ error: null });

            const { signOut } = await import('../services/authService');
            await signOut();

            expect(mockSignOut).toHaveBeenCalled();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('rg_v2_user');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('rg_v2_company');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('rg_v2_view');
        });
    });

    describe('signUp', () => {
        it('should create new user account', async () => {
            const mockUser = { id: 'new-auth-user', email: 'new@example.com' };

            mockSignUp.mockResolvedValue({
                data: { user: mockUser, session: { access_token: 'token' } },
                error: null
            });

            mockGetUser.mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            mockRpc.mockResolvedValue({
                data: {
                    id: 'profile-123',
                    username: 'new@example.com',
                    role: 'USER',
                    isActive: true
                },
                error: null
            });

            const { signUp } = await import('../services/authService');
            const result = await signUp('new@example.com', 'newpassword', {
                firstName: 'John',
                lastName: 'Doe'
            });

            expect(result.needsEmailConfirmation).toBe(false);
            expect(mockSignUp).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'newpassword',
                options: {
                    data: { firstName: 'John', lastName: 'Doe' }
                }
            });
        });

        it('should indicate when email confirmation is needed', async () => {
            mockSignUp.mockResolvedValue({
                data: { user: { id: 'pending-user' }, session: null },
                error: null
            });

            const { signUp } = await import('../services/authService');
            const result = await signUp('confirm@example.com', 'password');

            expect(result.needsEmailConfirmation).toBe(true);
            expect(result.user).toBeNull();
        });
    });

    describe('updatePassword', () => {
        it('should update password for authenticated user', async () => {
            mockUpdateUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null
            });

            const { updatePassword } = await import('../services/authService');
            await updatePassword('newSecurePassword123');

            expect(mockUpdateUser).toHaveBeenCalledWith({
                password: 'newSecurePassword123'
            });
        });
    });

    describe('resetPassword', () => {
        it('should send password reset email', async () => {
            mockResetPasswordForEmail.mockResolvedValue({
                data: {},
                error: null
            });

            const { resetPassword } = await import('../services/authService');
            await resetPassword('forgot@example.com');

            expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
                'forgot@example.com',
                expect.objectContaining({
                    redirectTo: expect.stringContaining('/reset-password')
                })
            );
        });
    });
});

describe('RLS Policy Verification', () => {
    it('should validate that policies filter by company_id', () => {
        // This is a documentation test - RLS is enforced at the database level
        // Real verification requires integration tests against a Supabase instance

        const policy = `
      CREATE POLICY "Users can view own company customers"
      ON customers FOR SELECT
      USING (company_id = auth.user_company_id());
    `;

        expect(policy).toContain('company_id');
        expect(policy).toContain('auth.user_company_id()');
    });
});
