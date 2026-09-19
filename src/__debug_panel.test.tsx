import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: (table: string) => {
      if (table === 'data_requests') {
        return {
          select: () => ({ order: () => Promise.resolve({ data: [{ id: 'r1', user_id: 'u1', request_type: 'deletion', status: 'pending', message: 'Please delete my data', admin_note: null, created_at: '2026-08-01T10:00:00Z' }], error: null }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    },
  },
}));

import DataRequestsPanel from '@/components/admin/DataRequestsPanel';

describe('debug panel select', () => {
  it('opens', async () => {
    render(<DataRequestsPanel />);
    await screen.findByText('Please delete my data');
    const combo = screen.getByRole('combobox');
    console.log('combo disabled:', combo.getAttribute('disabled'), combo.getAttribute('data-disabled'), combo.getAttribute('aria-expanded'));
    await userEvent.click(combo);
    console.log('after click aria-expanded:', combo.getAttribute('aria-expanded'));
    console.log('listbox:', !!screen.queryByRole('listbox'), 'options:', screen.queryAllByRole('option').map(o => o.textContent));
  });
});
