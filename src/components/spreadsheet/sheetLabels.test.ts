import { describe, it, expect } from 'vitest';
import { translateSheetValue, cleanNote } from './sheetLabels';

// Minimal stand-in for i18next `t`: resolves a flat dictionary, else default.
const dict: Record<string, string> = {
  'sheets.value.status.enrollment_paid': 'Enrolled & Paid',
  'sheets.value.status.new': 'New',
  'sheets.value.rewardStatus.approved': 'In payout request',
  'sheets.value.rewardStatus.paid': 'Paid',
  'sheets.value.kind.team': 'Team commission',
  'sheets.value.kind.partner': 'Partner commission',
  'sheets.value.role.social_media_partner': 'Partner',
  'sheets.value.method.bank_transfer': 'Bank transfer',
  'sheets.value.bool.yes': 'Active',
  'sheets.value.bool.no': 'Inactive',
  'sheets.value.programType.language_course': 'Language course',
  'sheets.value.month.aug': 'August',
};
const t = (key: string, fallback?: string) => dict[key] ?? fallback ?? '';

describe('translateSheetValue', () => {
  it('translates case statuses', () => {
    expect(translateSheetValue(t, 'status', 'enrollment_paid')).toBe('Enrolled & Paid');
    expect(translateSheetValue(t, 'status', 'new')).toBe('New');
  });

  it('translates reward and payout statuses', () => {
    expect(translateSheetValue(t, 'rewardStatus', 'approved')).toBe('In payout request');
    expect(translateSheetValue(t, 'rewardStatus', 'paid')).toBe('Paid');
  });

  it('translates commission kinds, including generated note strings', () => {
    expect(translateSheetValue(t, 'kind', 'team')).toBe('Team commission');
    expect(
      translateSheetValue(t, 'kind', 'Partner commission from case 11111111-2222-3333-4444-555555555555'),
    ).toBe('Partner commission');
  });

  it('translates roles and payment methods', () => {
    expect(translateSheetValue(t, 'role', 'social_media_partner')).toBe('Partner');
    expect(translateSheetValue(t, 'method', 'bank transfer')).toBe('Bank transfer');
  });

  it('renders booleans as Active / Inactive', () => {
    expect(translateSheetValue(t, 'bool', 'yes')).toBe('Active');
    expect(translateSheetValue(t, 'bool', true)).toBe('Active');
    expect(translateSheetValue(t, 'bool', 'no')).toBe('Inactive');
    expect(translateSheetValue(t, 'bool', false)).toBe('Inactive');
  });

  it('translates program types', () => {
    expect(translateSheetValue(t, 'programType', 'language course')).toBe('Language course');
  });

  it('formats month buckets as month + year', () => {
    expect(translateSheetValue(t, 'month', '2026-08')).toBe('August 2026');
    expect(translateSheetValue(t, 'month', '2026-08-01T00:00:00Z')).toBe('August 2026');
  });

  it('falls back to the raw value when unknown', () => {
    expect(translateSheetValue(t, 'status', 'brand_new_status')).toBe('brand_new_status');
  });

  it('renders an em dash for empty values', () => {
    expect(translateSheetValue(t, 'status', null)).toBe('—');
    expect(translateSheetValue(t, 'status', '')).toBe('—');
  });

  it('strips UUIDs from generated notes', () => {
    expect(cleanNote('Bonus for case 11111111-2222-3333-4444-555555555555')).toBe('Bonus for case');
  });
});
