import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Contract under test: every admin update to a data request records who made
 * it (handled_by, GDPR audit trail), while handled_at is stamped only when the
 * status transition is terminal (completed / rejected). Notes and non-terminal
 * transitions must leave handled_at untouched.
 */

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));

const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_ID = '55555555-5555-4555-8555-555555555555';

/** Server-side truth for the data_requests query. */
let requestsResult: any;
/** Server-side truth for the profiles lookup. */
let profilesResult: any;
/** Captured update payloads, one entry per .eq() call. */
const updates: { payload: any; filter: [string, string] }[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: ADMIN_ID } } }),
    },
    from: (table: string) => {
      if (table === 'data_requests') {
        return {
          select: () => ({ order: () => Promise.resolve(requestsResult) }),
          update: (payload: any) => ({
            eq: (col: string, val: string) => {
              updates.push({ payload, filter: [col, val] });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'profiles') {
        return { select: () => ({ in: () => Promise.resolve(profilesResult) }) };
      }
      throw new Error(`from('${table}') is not mocked`);
    },
  },
}));

import DataRequestsPanel from '../DataRequestsPanel';

const selectStatus = async (optionName: string) => {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
};

beforeEach(() => {
  toast.mockClear();
  updates.length = 0;
  requestsResult = {
    data: [
      {
        id: REQUEST_ID,
        user_id: USER_ID,
        request_type: 'deletion',
        status: 'pending',
        message: 'Please delete my data',
        admin_note: null,
        created_at: '2026-08-01T10:00:00Z',
      },
    ],
    error: null,
  };
  profilesResult = {
    data: [{ id: USER_ID, full_name: 'Student One', email: 'student@example.com' }],
    error: null,
  };
});

const renderPanel = async () => {
  render(<DataRequestsPanel />);
  await screen.findByText('Please delete my data');
};

describe('DataRequestsPanel — handled_by / handled_at audit semantics', () => {
  it('a note-only save records the admin but never stamps handled_at', async () => {
    await renderPanel();
    await userEvent.type(screen.getByRole('textbox'), 'Call the student first');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updates).toHaveLength(1));
    const { payload, filter } = updates[0];
    expect(filter).toEqual(['id', REQUEST_ID]);
    expect(payload).toMatchObject({
      admin_note: 'Call the student first',
      handled_by: ADMIN_ID,
    });
    expect(payload).not.toHaveProperty('handled_at');
  });

  it('completing a request stamps both handled_by and handled_at', async () => {
    await renderPanel();
    await selectStatus('myData.status.completed');

    await waitFor(() => expect(updates).toHaveLength(1));
    const { payload } = updates[0];
    expect(payload).toMatchObject({ status: 'completed', handled_by: ADMIN_ID });
    expect(payload.handled_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(payload.handled_at))).toBe(false);
  });

  it('rejecting a request stamps both handled_by and handled_at', async () => {
    await renderPanel();
    await selectStatus('myData.status.rejected');

    await waitFor(() => expect(updates).toHaveLength(1));
    const { payload } = updates[0];
    expect(payload).toMatchObject({ status: 'rejected', handled_by: ADMIN_ID });
    expect(payload.handled_at).toEqual(expect.any(String));
  });

  it('moving a request to in_progress records the admin but leaves handled_at untouched', async () => {
    await renderPanel();
    await selectStatus('myData.status.in_progress');

    await waitFor(() => expect(updates).toHaveLength(1));
    const { payload } = updates[0];
    expect(payload).toMatchObject({ status: 'in_progress', handled_by: ADMIN_ID });
    expect(payload).not.toHaveProperty('handled_at');
  });
});
