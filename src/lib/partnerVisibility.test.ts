import { describe, expect, it } from 'vitest';
import {
  PARTNER_CASE_SOURCES,
  resolvePartnerVisibilityMode,
  resolveVisibilitySources,
} from './partnerVisibility';

describe('resolveVisibilitySources', () => {
  it('uses partner sources when no override exists and global is off', () => {
    expect(resolveVisibilitySources(undefined, false)).toEqual(PARTNER_CASE_SOURCES);
  });

  it('uses all cases when no override exists and global is on', () => {
    expect(resolveVisibilitySources(null, true)).toBeNull();
  });

  it('honors legacy show_all_cases=true as all cases', () => {
    expect(resolveVisibilitySources({ show_all_cases: true }, false)).toBeNull();
  });

  it('honors legacy show_all_cases=false as partner sources', () => {
    expect(resolveVisibilitySources({ show_all_cases: false }, true)).toEqual(PARTNER_CASE_SOURCES);
  });

  it('treats legacy NULL as inherit rather than a hidden referral-only mode', () => {
    expect(resolveVisibilitySources({ show_all_cases: null }, false)).toEqual(PARTNER_CASE_SOURCES);
    expect(resolveVisibilitySources({ show_all_cases: undefined }, true)).toBeNull();
  });

  it('supports the explicit referral-only mode', () => {
    expect(resolveVisibilitySources({ visibility_mode: 'referral_only' }, true)).toEqual(['referral']);
  });

  it('prefers the explicit mode over the legacy boolean', () => {
    expect(resolveVisibilitySources({ visibility_mode: 'partner_sources', show_all_cases: true }, true))
      .toEqual(PARTNER_CASE_SOURCES);
  });
});

describe('resolvePartnerVisibilityMode', () => {
  it('returns the concrete resolved mode for empty-state messaging', () => {
    expect(resolvePartnerVisibilityMode({ visibility_mode: 'referral_only' }, false)).toBe('referral_only');
    expect(resolvePartnerVisibilityMode(undefined, false)).toBe('partner_sources');
    expect(resolvePartnerVisibilityMode(undefined, true)).toBe('all_cases');
  });
});
