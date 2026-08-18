import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentInviteToggle from '../AgentInviteToggle';

/**
 * Contract under test: the admin can BOTH grant and revoke the agent's
 * direct-invite permission from this component — the switch must open the
 * REVOKE dialog when ON and the GRANT dialog when OFF, confirm must persist
 * the requested value, and cancel must write nothing. (The end-to-end drawer
 * wiring is covered separately in MemberDetailDrawer.agentFlags.test.tsx.)
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

let updatePayload: Record<string, unknown> | null = null;
const updateCalls: Record<string, unknown>[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        updateCalls.push(payload);
        return {
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: { agent_can_invite_directly: payload.agent_can_invite_directly },
                error: null,
              }),
            }),
          }),
        };
      },
    }),
  },
}));

describe('AgentInviteToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePayload = null;
    updateCalls.length = 0;
  });

  it('opens the grant dialog from OFF and persists true on confirm', async () => {
    const onChanged = vi.fn();
    render(
      <AgentInviteToggle
        agentId="agent-1"
        agentName="Agent Adam"
        canInvite={false}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole('switch'));
    expect(await screen.findByText('Allow direct invites?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(true));
    expect(updatePayload).toEqual({ agent_can_invite_directly: true });
  });

  it('opens the REVOKE dialog from ON and persists false on confirm', async () => {
    const onChanged = vi.fn();
    render(
      <AgentInviteToggle
        agentId="agent-1"
        agentName="Agent Adam"
        canInvite={true}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole('switch'));
    expect(await screen.findByText('Disable direct invites?')).toBeInTheDocument();
    expect(screen.queryByText('Allow direct invites?')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(false));
    expect(updatePayload).toEqual({ agent_can_invite_directly: false });
  });

  it('cancel closes the dialog without writing', async () => {
    const onChanged = vi.fn();
    render(
      <AgentInviteToggle
        agentId="agent-1"
        agentName="Agent Adam"
        canInvite={true}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole('switch'));
    expect(await screen.findByText('Disable direct invites?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Disable direct invites?')).not.toBeInTheDocument(),
    );
    expect(updateCalls).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
