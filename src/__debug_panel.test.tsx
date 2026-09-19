import { describe, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));
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
    await userEvent.click(screen.getByRole('combobox'));
    const opts = screen.queryAllByRole('option');
    for (const o of opts) {
      console.log('OPTION text=%j aria-label=%j', o.textContent, o.getAttribute('aria-label'));
    }
  });
});
