import { describe, it, expect } from 'vitest';
import { normalizeRef, matchesRef } from './reference';

describe('reference search', () => {
  it('normalizes case and separators', () => {
    expect(normalizeRef('pay-2026-000017')).toBe('PAY2026000017');
    expect(normalizeRef(' drb 2026 000042 ')).toBe('DRB2026000042');
    expect(normalizeRef(null)).toBe('');
  });

  it('matches full, partial and separator-less spellings', () => {
    expect(matchesRef('PAY-2026-000017', 'pay-2026-000017')).toBe(true);
    expect(matchesRef('PAY-2026-000017', 'pay 2026 000017')).toBe(true);
    expect(matchesRef('PAY-2026-000017', 'PAY2026')).toBe(true);
    expect(matchesRef('DRB-2026-000042', 'drb-2026')).toBe(true);
  });

  it('matches a bare sequence number with or without padding', () => {
    expect(matchesRef('PAY-2026-000017', '17')).toBe(true);
    expect(matchesRef('PAY-2026-000017', '000017')).toBe(true);
    expect(matchesRef('PAY-2026-000017', '18')).toBe(false);
  });

  it('treats an empty query as a match and a missing reference as a miss', () => {
    expect(matchesRef('PAY-2026-000017', '')).toBe(true);
    expect(matchesRef(null, '17')).toBe(false);
  });
});
