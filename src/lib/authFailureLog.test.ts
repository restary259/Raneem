import { describe, it, expect } from 'vitest';
import { isAuthorizationError } from '@/lib/authFailureLog';

describe('isAuthorizationError', () => {
  it('detects postgres RLS denial codes', () => {
    expect(isAuthorizationError({ code: '42501' })).toBe(true);
    expect(isAuthorizationError({ code: 'PGRST301' })).toBe(true);
  });

  it('detects 401/403 responses', () => {
    expect(isAuthorizationError({ status: 401 })).toBe(true);
    expect(isAuthorizationError({ status: 403 })).toBe(true);
  });

  it('detects RLS message text', () => {
    expect(
      isAuthorizationError({ message: 'new row violates row-level security policy' }),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isAuthorizationError(null)).toBe(false);
    expect(isAuthorizationError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isAuthorizationError({ status: 500, message: 'server error' })).toBe(false);
  });
});
