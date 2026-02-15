/**
 * Basic integration test to verify unified auth system is working.
 * Uses normal ES imports instead of runtime require() to work with Jest mocking.
 */
import unifiedAuthService from '../services/unifiedAuthService';
import * as security from '../utils/security';

describe('Unified Auth Integration', () => {
  it('should export unified auth service with correct methods', () => {
    expect(unifiedAuthService).toBeDefined();
    expect(typeof unifiedAuthService.getAuthState).toBe('function');
    expect(typeof unifiedAuthService.signOut).toBe('function');
    expect(typeof unifiedAuthService.addListener).toBe('function');
    expect(typeof unifiedAuthService.hasPermission).toBe('function');
    expect(typeof unifiedAuthService.canAccessResource).toBe('function');
    expect(typeof unifiedAuthService.updateActivity).toBe('function');
  });

  it('should have security utilities', () => {
    expect(security.secureLog).toBeDefined();
    expect(security.RateLimiter).toBeDefined();
    expect(typeof security.secureSanitize).toBe('function');
    expect(typeof security.sanitizeFormData).toBe('function');
    expect(typeof security.analyzeSecurityRisk).toBe('function');
  });
});
