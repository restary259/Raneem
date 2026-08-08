import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Contract under test: the Master Partner toggle is optimistic at the row
 * level, so a partner must never be left displaying a status that the database
 * did not actually store — not after a failed write, and not after rapid
 * ON/OFF/ON toggling where responses can come back out of order.
 */

// --- Mocks -----------------------------------------------------------------

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));

/** Server-side truth, mutated only when an update actually resolves. */
let stored: Record<string, boolean> = {};
/** Optional per-call delay so writes can be made to resolve out of order. */
let delays: number[] = [];
/** Forces the next update to fail. */
let failNext = false;
const updateCalls: boolean[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (patch: any) => {
        const value = !!patch.is_master_partner;
        updateCalls.push(value);
        const delay = delays.shift() ?? 0;
        const shouldFail = failNext;
        failNext = false;
        const chain: any = {
          eq: (_col: string, id: string) => ({
            select: () => ({
              maybeSingle: () =>
                new Promise(resolve =>
                  setTimeout(() => {
                    if (shouldFail) {
                      resolve({ data: null, error: { message: 'network down' } });
                      return;
                    }
                    stored[id] = value;
                    resolve({ data: { is_master_partner: value }, error: null });
                  }, delay),
                ),
            }),
          }),
        };
        return chain;
      },
    }),
  },
}));

import MasterPartnerToggle from '../MasterPartnerToggle';

// --- Harness ---------------------------------------------------------------

const PARTNER_ID = 'p-1';

/** Mirrors the optimistic row state kept by PartnersDirectory / AdminTeamPage. */
const Harness: React.FC<{ initial: boolean }> = ({ initial }) => {
  const [isMaster, setIsMaster] = useState(initial);
  return (
    <div>
      <span data-testid="row-status">{isMaster ? 'master' : 'partner'}</span>
      <MasterPartnerToggle
        partnerId={PARTNER_ID}
        partnerName="Ryan"
        isMaster={isMaster}
        onChanged={setIsMaster}
      />
    </div>
  );
};

const confirm = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: /confirm/i }));
};

const flip = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('switch'));
  await confirm(user);
};

beforeEach(() => {
  stored = { [PARTNER_ID]: false };
  delays = [];
  failNext = false;
  updateCalls.length = 0;
  toast.mockClear();
});

// --- Tests -----------------------------------------------------------------

describe('MasterPartnerToggle', () => {
  it('asks for confirmation before writing anything', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);

    await user.click(screen.getByRole('switch'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(updateCalls).toHaveLength(0);
    expect(screen.getByTestId('row-status')).toHaveTextContent('partner');
  });

  it('cancelling leaves the partner untouched', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);

    await user.click(screen.getByRole('switch'));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(updateCalls).toHaveLength(0);
    expect(screen.getByTestId('row-status')).toHaveTextContent('partner');
    expect(stored[PARTNER_ID]).toBe(false);
  });

  it('upgrades and downgrades, keeping the row in sync with the database', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);

    await flip(user);
    await waitFor(() => expect(screen.getByTestId('row-status')).toHaveTextContent('master'));
    expect(stored[PARTNER_ID]).toBe(true);

    await flip(user);
    await waitFor(() => expect(screen.getByTestId('row-status')).toHaveTextContent('partner'));
    expect(stored[PARTNER_ID]).toBe(false);
  });

  it('rapid ON/OFF/ON toggling ends on the value the database stored', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);

    // Slow first write, faster later ones: without in-flight guarding the
    // responses would interleave and the row could settle on a stale flag.
    delays = [60, 10, 0];

    await flip(user); // ON
    await waitFor(() => expect(screen.getByTestId('row-status')).toHaveTextContent('master'));
    await flip(user); // OFF
    await waitFor(() => expect(screen.getByTestId('row-status')).toHaveTextContent('partner'));
    await flip(user); // ON

    await waitFor(() => {
      expect(screen.getByTestId('row-status')).toHaveTextContent(stored[PARTNER_ID] ? 'master' : 'partner');
    });
    expect(stored[PARTNER_ID]).toBe(true);
    expect(updateCalls).toEqual([true, false, true]);
  });

  it('ignores extra confirmations while a write is still in flight', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);
    delays = [80];

    await user.click(screen.getByRole('switch'));
    const dialog = await screen.findByRole('alertdialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm/i });
    // Double-click the confirm action before the promise settles.
    await user.click(confirmBtn);
    await user.click(confirmBtn).catch(() => {});

    await waitFor(() => expect(screen.getByTestId('row-status')).toHaveTextContent('master'));
    expect(updateCalls).toEqual([true]);
  });

  it('a failed write never leaves the partner showing the wrong status', async () => {
    const user = userEvent.setup();
    render(<Harness initial={false} />);
    failNext = true;

    await flip(user);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
    expect(screen.getByTestId('row-status')).toHaveTextContent('partner');
    expect(stored[PARTNER_ID]).toBe(false);
    expect((screen.getByRole('switch') as HTMLElement).getAttribute('aria-checked')).toBe('false');
  });

  it('a failed downgrade keeps the partner a master partner', async () => {
    const user = userEvent.setup();
    stored[PARTNER_ID] = true;
    render(<Harness initial={true} />);
    failNext = true;

    await flip(user);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
    expect(screen.getByTestId('row-status')).toHaveTextContent('master');
    expect(stored[PARTNER_ID]).toBe(true);
  });
});
