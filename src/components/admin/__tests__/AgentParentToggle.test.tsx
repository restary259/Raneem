import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentParentToggle from '../AgentParentToggle';

/**
 * Contract under test: the two-step user_roles -> profiles lookup must resolve
 * the current agent's name, and the assign/reassign action must open the dialog
 * and persist profiles.agent_id.
 */

type TranslationOptions = string | { defaultValue?: string; name?: string };

const state = vi.hoisted(() => ({
  roleRows: [] as { user_id: string }[],
  profileRows: [] as { id: string; full_name: string | null }[],
  profileInIds: [] as string[],
  updatePayload: null as { agent_id: string | null } | null,
  fromCalls: [] as string[],
  toast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: TranslationOptions) => {
      const template = typeof options === 'string' ? options : (options?.defaultValue ?? key);
      return typeof options === 'object' && options.name
        ? template.replace('{{name}}', options.name)
        : template;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.fromCalls.push(table);
      if (table === 'user_roles') {
        return {
          select: () => ({
            eq: async () => ({ data: state.roleRows, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => {
              state.profileInIds = ids;
              return { data: state.profileRows, error: null };
            },
          }),
          update: (payload: { agent_id: string | null }) => {
            state.updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: { agent_id: payload.agent_id },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

describe('AgentParentToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.roleRows = [
      { user_id: 'agent-1' },
      { user_id: 'agent-2' },
    ];
    state.profileRows = [
      { id: 'agent-1', full_name: 'Agent Adam' },
      { id: 'agent-2', full_name: 'Agent Maya' },
    ];
    state.profileInIds = [];
    state.updatePayload = null;
    state.fromCalls = [];
  });

  it('resolves the linked agent name through the two-step lookup', async () => {
    render(
      <AgentParentToggle
        recruitId="partner-1"
        recruitName="Partner Paula"
        currentAgentId="agent-1"
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText('Agent Adam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeInTheDocument();
    expect(state.fromCalls).toEqual(['user_roles', 'profiles']);
    expect(state.profileInIds).toEqual(['agent-1', 'agent-2']);
  });

  it('shows No agent and opens the assign dialog when no agent is linked', async () => {
    render(
      <AgentParentToggle
        recruitId="partner-1"
        recruitName="Partner Paula"
        currentAgentId={null}
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText('No agent')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Assign agent' }));

    expect(await screen.findByText('Assign agent for Partner Paula')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('persists the selected agent and reports the new parent', async () => {
    const onChanged = vi.fn();
    render(
      <AgentParentToggle
        recruitId="partner-1"
        recruitName="Partner Paula"
        currentAgentId={null}
        onChanged={onChanged}
      />,
    );

    await screen.findByText('No agent');
    await userEvent.click(screen.getByRole('button', { name: 'Assign agent' }));
    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Agent Adam' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('agent-1'));
    expect(state.updatePayload).toEqual({ agent_id: 'agent-1' });
    expect(state.toast).toHaveBeenCalledWith({ title: 'Assigned to agent' });
  });
});
