import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Contract under test: the gate opens only after the unified server boundary
 * confirms both the Auth update and profile-flag persistence.
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

let invokeResult: { data: any; error: any };
const invoke = vi.fn(async (_name: string, _options: any) => invokeResult);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invoke(a[0], a[1]) },
  },
}));

import ForcePasswordChange from '../ForcePasswordChange';

beforeEach(() => {
  toast.mockClear();
  invoke.mockClear();
  invokeResult = { data: { success: true }, error: null };
});

const typeAndSubmit = async (onDone: () => void) => {
  render(<ForcePasswordChange userId="user-1" onDone={onDone} />);
  const pw = 'Str0ng!Passw0rd';
  const [newPw, confirmPw] = screen.getAllByPlaceholderText(/forcePassword/);
  await userEvent.type(newPw, pw);
  await userEvent.type(confirmPw, pw);
  await userEvent.click(screen.getByRole('button', { name: /forcePassword\.submit/ }));
};

describe('ForcePasswordChange — verified password boundary', () => {
  it('uses the unified function and proceeds on the happy path', async () => {
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('change-own-password', {
      body: { password: 'Str0ng!Passw0rd' },
    }));
    expect(onDone).toHaveBeenCalled();
  });

  it('keeps the gate closed when the server cannot verify completion', async () => {
    invokeResult = { data: null, error: new Error('Function failed') };
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not call onDone when the password update itself fails', async () => {
    invokeResult = { data: null, error: new Error('Auth session missing') };
    const onDone = vi.fn();
    await typeAndSubmit(onDone);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledOnce();
  });
});
