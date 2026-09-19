import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamInboxPage from '../TeamInboxPage';

/**
 * Layout contract for the messaging inbox tabs.
 *
 * The page renders inside `main`, which already sits below the app header, so
 * the tab strip must stick at its own top edge (`top-0`). A `top-14` offset
 * added the header height a second time, pushing the strip down over the page
 * heading.
 *
 * Both panels must also be sized by the flex column (a fixed strip plus a
 * `flex-1 min-h-0` panel) rather than computing their own viewport height, so
 * the active panel scrolls internally instead of spilling into `main`.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/pages/messages/CaseMessagesInboxPage', () => ({
  default: () => <div data-testid="case-messages">case messages</div>,
}));
vi.mock('@/pages/messages/WhatsAppInboxPage', () => ({
  default: () => <div data-testid="whatsapp">whatsapp</div>,
}));

const renderPage = (initialEntry = '/admin/messages') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TeamInboxPage />
    </MemoryRouter>,
  );

describe('TeamInboxPage layout', () => {
  it('anchors the sticky tab strip to the top of the scroll container', () => {
    const { container } = renderPage();
    const bar = container.querySelector('.sticky');
    expect(bar).not.toBeNull();
    expect(bar!.className).toContain('top-0');
    expect(bar!.className).not.toContain('top-14');
  });

  it('sizes both panels from the flex column instead of a viewport height', () => {
    const { container } = renderPage();
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels.length).toBe(2);
    for (const panel of panels) {
      expect(panel.className).toContain('min-h-0');
      expect(panel.className).toContain('flex-1');
      // A hardcoded `100dvh - <chrome>` height drifts from the real header.
      expect(panel.className).not.toMatch(/dvh|calc\(/);
    }
  });

  it('gives the panel a definite height to scroll within', () => {
    const { container } = renderPage();
    const root = container.querySelector('[data-orientation]')!;
    expect(root.className).toContain('h-full');
  });

  it('renders only the selected tab panel', () => {
    renderPage('/admin/messages');
    expect(screen.getByTestId('case-messages')).toBeInTheDocument();
    // Radix unmounts the inactive panel's children, so this can never render.
    expect(screen.queryByTestId('whatsapp')).not.toBeInTheDocument();
  });

  it('renders the whatsapp panel when that tab is selected', () => {
    renderPage('/admin/messages?tab=whatsapp');
    expect(screen.getByTestId('whatsapp')).toBeInTheDocument();
    expect(screen.queryByTestId('case-messages')).not.toBeInTheDocument();
  });
});