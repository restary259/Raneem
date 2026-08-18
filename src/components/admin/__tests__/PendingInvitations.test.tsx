import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PendingInvitations from '../PendingInvitations';

/**
 * Contract under test: defense-in-depth for stale pending invitations. A
 * pending user_invitations row whose invited_email already belongs to an
 * active member account (passed in via `activeEmails` from AdminMembersPage)
 * must NOT render under "Pending invitations" — the account is already live,
 * so the invitation is not genuinely pending. Rows with no matching active
 * email, and rows whose only matching member is deactivated (excluded from
 * `activeEmails` by the caller), stay visible.
 */

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any, opts?: any) => {
      const base = typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k);
      return opts?.name ? base.replace('{{name}}', opts.name) : base;
    },
    i18n: { language: 'en' },
  }),
}));

let rows: any[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: async () => ({ data: rows, error: null }),
          }),
        }),
      }),
    }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  },
}));

const inv = (id: string, email: string) => ({
  id,
  invited_email: email,
  invited_name: null,
  invitation_type: 'partner',
  intended_role: 'social_media_partner',
  status: 'pending',
  expires_at: '2026-12-31T00:00:00Z',
  created_at: '2026-08-18T00:00:00Z',
});

describe('PendingInvitations activeEmails filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [];
  });

  it('hides a pending invitation whose email belongs to an active member', async () => {
    rows = [inv('1', 'stuck.partner@example.com')];
    const { container } = render(
      <PendingInvitations activeEmails={['stuck.partner@example.com']} />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument();
  });

  it('matches active emails case-insensitively', async () => {
    rows = [inv('1', 'Stuck.Partner@Example.com')];
    const { container } = render(
      <PendingInvitations activeEmails={['stuck.partner@example.com']} />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows a pending invitation whose email has no active account', async () => {
    rows = [inv('1', 'genuinely.pending@example.com')];
    render(<PendingInvitations activeEmails={['someone.else@example.com']} />);
    // The email text renders in two <p> nodes (name fallback + email line).
    expect((await screen.findAllByText('genuinely.pending@example.com')).length).toBeGreaterThan(0);
    expect(screen.getByText('Pending invitations')).toBeInTheDocument();
  });

  it('hides only the matched row when invitations are mixed', async () => {
    rows = [inv('1', 'active.member@example.com'), inv('2', 'still.pending@example.com')];
    render(<PendingInvitations activeEmails={['active.member@example.com']} />);
    expect((await screen.findAllByText('still.pending@example.com')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('active.member@example.com')).toHaveLength(0);
  });

  it("does NOT hide a row whose only matching member is deactivated (the caller excludes deactivated emails)", async () => {
    // AdminMembersPage excludes is_deactivated members from activeEmails, so a
    // deactivated member's email never reaches the component — the pending
    // invitation must stay visible (an admin may want to resend/revoke it).
    rows = [inv('1', 'deactivated.member@example.com')];
    render(<PendingInvitations activeEmails={[]} />);
    expect((await screen.findAllByText('deactivated.member@example.com')).length).toBeGreaterThan(0);
  });
});
