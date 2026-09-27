import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BankDetailsEditor from '../BankDetailsEditor';

/**
 * Contract under test: the single shared bank editor loads the saved profiles
 * row, renders the country-specific IL/DE field sets, writes the full column
 * payload on save, and locks all inputs once an admin has confirmed.
 */

type TranslationOptions = string | { defaultValue?: string };

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updatePayload: null as Record<string, unknown> | null,
  updateError: null as { message: string } | null,
  toast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: TranslationOptions) => {
      const template = typeof options === 'string' ? options : (options?.defaultValue ?? key);
      return template;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.row, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          state.updatePayload = payload;
          return {
            eq: async () => ({ error: state.updateError }),
          };
        },
      };
    },
  },
}));

describe('BankDetailsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.row = null;
    state.updatePayload = null;
    state.updateError = null;
  });

  it('loads existing Israeli details into the fields', async () => {
    state.row = {
      bank_country: 'il',
      bank_account_holder: 'Moshe Cohen',
      bank_name: 'Bank Hapoalim',
      bank_branch: '123',
      bank_account_number: '456789',
      iban: 'IL620108000000099999999',
      bic: null,
      iban_confirmed_at: null,
    };

    render(<BankDetailsEditor userId="u1" />);

    expect(await screen.findByDisplayValue('Bank Hapoalim')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Moshe Cohen')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('456789')).toBeInTheDocument();
    // IL hides the German-only BIC field
    expect(screen.queryByLabelText('BIC / SWIFT (optional)')).not.toBeInTheDocument();
  });

  it('switching to German shows IBAN/BIC/bank-name and hides IL branch/account', async () => {
    render(<BankDetailsEditor userId="u1" />);
    await screen.findByText('Israeli account');

    await userEvent.click(screen.getByText('German account'));

    expect(screen.getByLabelText('IBAN')).toBeInTheDocument();
    expect(screen.getByLabelText('BIC / SWIFT (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch number')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Account number')).not.toBeInTheDocument();
  });

  it('saves the full column payload including bank_country and bic', async () => {
    state.row = {
      bank_country: 'de',
      bank_account_holder: 'Anna Schmidt',
      bank_name: 'Commerzbank',
      bank_branch: null,
      bank_account_number: null,
      iban: 'DE89370400440532013000',
      bic: 'cobadeffxxx',
      iban_confirmed_at: null,
    };

    render(<BankDetailsEditor userId="u1" />);
    await screen.findByDisplayValue('Commerzbank');

    await userEvent.click(screen.getByRole('button', { name: /Save bank details/ }));

    await waitFor(() => expect(state.updatePayload).not.toBeNull());
    expect(state.updatePayload).toEqual({
      bank_country: 'de',
      bank_account_holder: 'Anna Schmidt',
      bank_name: 'Commerzbank',
      bank_branch: null,
      bank_account_number: null,
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    });
    expect(state.toast).toHaveBeenCalledWith({ description: 'Bank details saved' });
  });

  it('disables the country cards, inputs and Save once confirmed', async () => {
    state.row = {
      bank_country: 'il',
      bank_account_holder: 'Moshe Cohen',
      bank_name: 'Bank Hapoalim',
      bank_branch: '123',
      bank_account_number: '456789',
      iban: null,
      bic: null,
      iban_confirmed_at: '2026-01-01T00:00:00Z',
    };

    render(<BankDetailsEditor userId="u1" />);
    await screen.findByDisplayValue('Bank Hapoalim');

    expect(screen.getByDisplayValue('Bank Hapoalim')).toBeDisabled();
    expect(screen.getByDisplayValue('Moshe Cohen')).toBeDisabled();
    expect(screen.getByDisplayValue('123')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save bank details/ })).toBeDisabled();
    expect(screen.getByText('Bank details are confirmed and can only be changed by an admin.')).toBeInTheDocument();
  });

  it('rejects a missing account holder name with a destructive toast', async () => {
    render(<BankDetailsEditor userId="u1" />);
    await screen.findByText('Israeli account');

    await userEvent.click(screen.getByRole('button', { name: /Save bank details/ }));

    expect(state.updatePayload).toBeNull();
    expect(state.toast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'Account holder name is required',
    });
  });

  it('requires the holder even when the rest of the Israeli fields are filled', async () => {
    state.row = {
      bank_country: 'il',
      bank_account_holder: null,
      bank_name: 'Bank Hapoalim',
      bank_branch: '123',
      bank_account_number: '456789',
      iban: null,
      bic: null,
      iban_confirmed_at: null,
    };

    render(<BankDetailsEditor userId="u1" />);
    await screen.findByDisplayValue('Bank Hapoalim');

    await userEvent.click(screen.getByRole('button', { name: /Save bank details/ }));

    expect(state.updatePayload).toBeNull();
    expect(state.toast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'Account holder name is required',
    });
  });
});
