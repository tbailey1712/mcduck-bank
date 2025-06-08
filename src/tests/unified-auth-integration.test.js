/**
 * Basic integration test to verify unified auth system is working
 */

describe('Unified Auth Integration', () => {
  it('should have all required auth files', () => {
    // Test that we can import the unified auth service
    expect(() => require('../services/unifiedAuthService')).not.toThrow();
    
    // Test that we can import the unified auth provider
    expect(() => require('../contexts/UnifiedAuthProvider')).not.toThrow();
    
    // Test that we can import updated components
    expect(() => require('../App')).not.toThrow();
    expect(() => require('../components/Navbar')).not.toThrow();
    expect(() => require('../pages/Profile')).not.toThrow();
    expect(() => require('../pages/AuthPage')).not.toThrow();
  });
  
  it('should export unified auth service with correct methods', () => {
    const unifiedAuthService = require('../services/unifiedAuthService').default;
    
    expect(unifiedAuthService).toBeDefined();
    expect(typeof unifiedAuthService.getAuthState).toBe('function');
    expect(typeof unifiedAuthService.signOut).toBe('function');
    expect(typeof unifiedAuthService.addListener).toBe('function');
    expect(typeof unifiedAuthService.hasPermission).toBe('function');
    expect(typeof unifiedAuthService.canAccessResource).toBe('function');
    expect(typeof unifiedAuthService.updateActivity).toBe('function');
  });

  it('should have security utilities', () => {
    const security = require('../utils/security');
    
    expect(security.secureLog).toBeDefined();
    expect(security.RateLimiter).toBeDefined();
    expect(typeof security.secureSanitize).toBe('function');
    expect(typeof security.sanitizeFormData).toBe('function');
    expect(typeof security.analyzeSecurityRisk).toBe('function');
  });
});