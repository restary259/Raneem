import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Contract under test: once supabase.auth.updateUser succeeds, the user must
 * never be trapped on the force-password screen. A failed flag-clearing RPC
 * (missing function, blocking trigger, network) degrades to a warning toast +
 * onDone(), not a permanent blocker.
 */

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));

vi.mock('@/components/auth/PasswordStrength', () => ({
  default: () => null,
  validatePassword: (pw: string) => pw.length >= 10,
}));

let updateUserResult: { error: any };
let rpcResult: { error: any };
const updateUser = vi.fn(async (_patch: any) => updateUserResult);
const rpc = vi.fn(async (_name: string) => rpcResult);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { updateUser: (...a: any[]) => updateUser(a[0]) },
    rpc: (...a: any[]) => rpc(a[0]),
  },
}));

import ForcePasswordChange from '../ForcePasswordChange';

beforeEach(() => {
  toast.mockClear();
  updateUser.mockClear();
  rpc.mockClear();
  updateUserResult = { error: null };
  rpcResult = { error: null };
});

const typeAndSubmit = async (onDone: () => void) => {
  render(<ForcePasswordChange userId="user-1" onDone={onDone} />);
  const pw = 'Str0ng!Passw0rd';
  const [newPw, confirmPw] = screen.getAllByPlaceholderText(/forcePassword/);
  await userEvent.type(newPw, pw);
  await userEvent.type(confirmPw, pw);
  await userEvent.click(screen.getByRole('button', { name: /forcePassword\.submit/ }));
};

describe('ForcePasswordChange — flag-clear resilience', () => {
  it('clears the flag via RPC and proceeds on the happy path', async () => {
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('clear_must_change_password'));
    expect(onDone).toHaveBeenCalled();
  });

  it('still calls onDone with a warning when the flag RPC is missing or blocked', async () => {
    rpcResult = { error: { message: 'Could not find the function public.clear_must_change_password' } };
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('does not call onDone when the password update itself fails', async () => {
    updateUserResult = { error: { message: 'Auth session missing' } };
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
