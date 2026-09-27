import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BankDetailsShareDialog from '../BankDetailsShareDialog';
import type { BankDetailsPayload } from '@/lib/chatFormat';

/**
 * Contract under test: the share preview disables "Send details" when nothing is
 * saved, always offers a link to the role's bank editor (Add vs Manage), and
 * shows a spinner + disabled Send while submitting.
 */

type TranslationOptions = string | { defaultValue?: string };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: TranslationOptions) =>
      typeof options === 'string' ? options : (options?.defaultValue ?? key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/lib/router-compat', () => ({
  Link: ({ to, children, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const EMPTY: BankDetailsPayload = {
  bankCountry: 'il',
  bankHolder: '',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
  iban: '',
  bic: '',
};

const FILLED: BankDetailsPayload = {
  bankCountry: 'il',
  bankHolder: 'Moshe Cohen',
  bankName: 'Bank Hapoalim',
  bankBranch: '123',
  bankAccount: '456789',
  iban: '',
  bic: '',
};

describe('BankDetailsShareDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers an Add link and disables Send when nothing is saved', () => {
    render(
      <BankDetailsShareDialog
        open
        details={EMPTY}
        submitting={false}
        bankDetailsPath="/partner/profile"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Send details/ })).toBeDisabled();
    const add = screen.getByRole('link', { name: /Add bank details/ });
    expect(add).toHaveAttribute('href', '/partner/profile');
  });

  it('offers a Manage link and enables Send when details exist', () => {
    render(
      <BankDetailsShareDialog
        open
        details={FILLED}
        submitting={false}
        bankDetailsPath="/agent/earnings?tab=bank"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Send details/ })).toBeEnabled();
    const manage = screen.getByRole('link', { name: /Manage bank details/ });
    expect(manage).toHaveAttribute('href', '/agent/earnings?tab=bank');
  });

  it('disables Send while submitting', () => {
    render(
      <BankDetailsShareDialog
        open
        details={FILLED}
        submitting
        bankDetailsPath="/partner/profile"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Send details/ })).toBeDisabled();
  });

  it('shows a spinner while the preview is still loading', () => {
    render(
      <BankDetailsShareDialog
        open
        details={null}
        submitting={false}
        bankDetailsPath="/partner/profile"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // Radix renders dialog content in a portal on document.body.
    expect(document.querySelector('.animate-spin')).not.toBeNull();
  });
});
