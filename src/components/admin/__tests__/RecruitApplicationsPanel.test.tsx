import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Contract under test: approving a partner recruit is a single, retry-safe
 * admin action that creates (or reuses) the account, links it to the recruiting
 * agent and sends the branded activation email. The panel must:
 *  - call the edge function with the application id and `approve`
 *  - surface a clear success/failure state for the activation email
 *  - expose "Resend invite" once the row is approved
 *  - never leave the row in a half-approved visual state after an error
 */

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any, opts?: any) => {
      const base = typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k);
      return opts?.email ? base.replace('{{email}}', opts.email) : base;
    },
    i18n: { language: 'en' },
  }),
}));

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = '22222222-2222-4222-8222-222222222222';
const RECRUIT_EMAIL = 'tsukuyomidomain00@gmail.com';

/** Server-side truth for the application row. */
let row: any;
/** When set, the applications query fails with this error. */
let loadError: any;
/** Response the edge function should return next. */
let invokeResult: any;
const invoke = vi.fn(async (_name: string, _opts: any) => {
  const result = invokeResult;
  if (result?.data?.success && _opts.body.action === 'approve') {
    row = { ...row, status: 'approved', created_user_id: 'user-1' };
  }
  return result;
});
const rpc = vi.fn(async () => {
  row = { ...row, status: 'rejected' };
  return { error: null };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invoke(a[0], a[1]) },
    rpc: (...a: any[]) => rpc(),
    from: () => ({
      select: () => ({
        order: () =>
          Promise.resolve(loadError ? { data: null, error: loadError } : { data: [row], error: null }),
      }),
    }),
  },
}));

import RecruitApplicationsPanel from '../RecruitApplicationsPanel';

beforeEach(() => {
  toast.mockClear();
  invoke.mockClear();
  rpc.mockClear();
  row = {
    id: APPLICATION_ID,
    recruit_code: 'MP-DCAF',
    agent_id: AGENT_ID,
    full_name: 'Nadeem Recruit',
    email: RECRUIT_EMAIL,
    phone: '0500000000',
    city: 'Nazareth',
    social_link: null,
    note: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    agent: { full_name: 'Recruiting Agent' },
  };
  loadError = null;
  invokeResult = { data: { success: true, emailed: true, user_id: 'user-1' }, error: null };
});

const renderPanel = async () => {
  render(<RecruitApplicationsPanel />);
  await screen.findByText('Nadeem Recruit');
};

describe('RecruitApplicationsPanel — approve recruit → account → invite', () => {
  it('shows the recruiting agent and the recruit code', async () => {
    await renderPanel();
    expect(screen.getByText('Recruiting Agent')).toBeInTheDocument();
    expect(screen.getByText('(MP-DCAF)')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(RECRUIT_EMAIL))).toBeInTheDocument();
  });

  it('approve calls the edge function once with the application id', async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith('approve-partner-recruit', {
      body: { application_id: APPLICATION_ID, action: 'approve' },
    });
  });

  it('confirms the branded activation email was sent to the applied address', async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: `Activation email sent to ${RECRUIT_EMAIL}`,
          variant: undefined,
        }),
      ),
    );
  });

  it('flags a failed activation email instead of reporting a clean success', async () => {
    invokeResult = { data: { success: true, emailed: false, user_id: 'user-1' }, error: null };
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
  });

  it('swaps the row to approved with a resend-invite action', async () => {
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await screen.findByRole('button', { name: /Resend invite/i });
    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
  });

  it('resend invite reuses the same application without re-approving it', async () => {
    row = { ...row, status: 'approved', created_user_id: 'user-1' };
    invokeResult = { data: { success: true, emailed: true }, error: null };
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Resend invite/i }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('approve-partner-recruit', {
        body: { application_id: APPLICATION_ID, action: 'resend_invite' },
      }),
    );
  });

  it('an already-approved application keeps its state when approval is rejected server-side', async () => {
    invokeResult = { data: { error: 'This application was already approved' }, error: null };
    await renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'This application was already approved',
        }),
      ),
    );
    expect(screen.getByRole('button', { name: /Approve/i })).toBeEnabled();
  });

  it('surfaces a destructive toast instead of an empty list when the query fails', async () => {
    loadError = { message: 'permission denied for table partner_recruit_applications' };
    render(<RecruitApplicationsPanel />);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'permission denied for table partner_recruit_applications',
        }),
      ),
    );
    await screen.findByText('No recruit applications');
  });
});
