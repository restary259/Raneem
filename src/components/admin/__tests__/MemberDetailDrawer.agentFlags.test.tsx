import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberDetailDrawer from '../MemberDetailDrawer';
import type { MemberRow } from '../MemberList';

/**
 * Contract under test: the drawer wires the agent permission toggles to REAL
 * state. Regression guard for the reported bug — the drawer previously
 * hardcoded canInvite={false}/canCreateAccounts={false} with a no-op
 * onChanged, so the switches always showed OFF and an enabled permission
 * could never be disabled. These tests exercise the full drawer path:
 * fetch flags -> render switches -> confirm in dialog -> switch follows the
 * persisted value.
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

let flagsResult: { data: unknown; error: unknown };
let flagsCalls = 0;
const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => ({
      data: {
        account: null,
        rewards: [],
        totals: { total: 0, pending: 0, paid: 0, by_type: {} },
        rate_changes: [],
      },
      error: null,
    }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            flagsCalls++;
            return flagsResult;
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updateCalls.push({ table, payload });
        return {
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { ...payload }, error: null }),
            }),
          }),
        };
      },
    }),
  },
}));

const AGENT_MEMBER: MemberRow = {
  requester_id: 'agent-1',
  full_name: 'Agent Adam',
  email: 'adam@example.com',
  phone_number: null,
  city: null,
  created_at: '2026-01-01T00:00:00Z',
  role: 'agent',
  referral_code: null,
  agent_id: null,
  is_deactivated: false,
  assigned_cases: 0,
  enrolled_cases: 0,
  team_reward_total: 0,
  recruited_count: 0,
  earned_override: 0,
  students_count: 0,
  earned_referral: 0,
  total_earned: 0,
  paid_amount: 0,
  locked_amount: 0,
  available_amount: 0,
  open_requests: 0,
  open_request_amount: 0,
  last_request_at: null,
  direct_enrolled_cases: 0,
  network_enrolled_cases: 0,
};

const renderDrawer = () =>
  render(
    <MemberDetailDrawer
      member={AGENT_MEMBER}
      open
      onOpenChange={() => {}}
      onChanged={() => {}}
    />,
  );

// The permission switches now live on the "Permissions & Access" tab of the
// drawer; the Overview tab is the default. Radix unmounts the inactive panel,
// so the tab must be opened before the agent toggles mount.
const openPermissionsTab = async () => {
  await userEvent.click(screen.getByRole('tab', { name: /permissions/i }));
};

const switchState = (el: HTMLElement) => el.getAttribute('data-state');

// The drawer renders one switch per per-profile flag, and that set grows as
// flags are added (voice calls is a third). These queries name the switch
// instead of counting by index, so a future flag cannot silently shift an
// assertion onto the wrong control.
const inviteSwitch = () => screen.getByRole('switch', { name: 'Direct invites' });
const createSwitch = () => screen.getByRole('switch', { name: 'Manual account creation' });

describe('MemberDetailDrawer agent permission toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagsCalls = 0;
    updateCalls.length = 0;
  });

  it('renders the persisted flag state (invite ON, create OFF)', async () => {
    flagsResult = {
      data: { agent_can_invite_directly: true, agent_can_create_accounts: false },
      error: null,
    };
    renderDrawer();
    await openPermissionsTab();

    await waitFor(() => expect(inviteSwitch()).toBeInTheDocument());
    expect(switchState(inviteSwitch())).toBe('checked');
    expect(switchState(createSwitch())).toBe('unchecked');
  });

  it('grant persists and the switch flips ON (no snap-back)', async () => {
    flagsResult = {
      data: { agent_can_invite_directly: false, agent_can_create_accounts: false },
      error: null,
    };
    renderDrawer();
    await openPermissionsTab();

    await waitFor(() => expect(inviteSwitch()).toBeInTheDocument());
    const invite = inviteSwitch();
    expect(switchState(invite)).toBe('unchecked');

    await userEvent.click(invite);
    expect(await screen.findByText('Allow direct invites?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(switchState(invite)).toBe('checked'));
    expect(updateCalls).toEqual([
      { table: 'profiles', payload: { agent_can_invite_directly: true } },
    ]);
  });

  it('revoke persists and the switch flips OFF', async () => {
    flagsResult = {
      data: { agent_can_invite_directly: true, agent_can_create_accounts: false },
      error: null,
    };
    renderDrawer();
    await openPermissionsTab();

    await waitFor(() => expect(inviteSwitch()).toBeInTheDocument());
    const invite = inviteSwitch();
    expect(switchState(invite)).toBe('checked');

    await userEvent.click(invite);
    expect(await screen.findByText('Disable direct invites?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(switchState(invite)).toBe('unchecked'));
    expect(updateCalls).toEqual([
      { table: 'profiles', payload: { agent_can_invite_directly: false } },
    ]);
  });

  it('load error shows a retryable error row, and retry recovers', async () => {
    flagsResult = { data: null, error: { message: 'boom' } };
    renderDrawer();
    await openPermissionsTab();

    expect(
      await screen.findByText("Couldn't load this account's permissions."),
    ).toBeInTheDocument();
    // A failed flags read gates the whole permissions panel — no switch may
    // render as OFF when its true value is unknown.
    expect(screen.queryByRole('switch', { name: 'Direct invites' })).toBeNull();
    const callsAfterError = flagsCalls;

    flagsResult = {
      data: { agent_can_invite_directly: false, agent_can_create_accounts: true },
      error: null,
    };
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(inviteSwitch()).toBeInTheDocument());
    expect(flagsCalls).toBeGreaterThan(callsAfterError);
    expect(switchState(createSwitch())).toBe('checked');
  });
});
