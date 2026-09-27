import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MajorModal from '../MajorModal';
import { majorsData, SubMajor } from '@/data/majorsData';
import en from '@/locales/en/common.json';

/**
 * Contract under test: the MajorModal shell was redesigned (centered dialog /
 * mobile bottom sheet, blurred backdrop, fade+scale entrance) but its CONTENT
 * must not change. These cases pin the sections that make up the existing
 * modal for a verified major (glance chips, admission tiers, language, about,
 * careers, Arab-48 notes, sources) and the conditional suppression rules for
 * a major that has no verified data.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const parts = _k.split('.');
      let cur: unknown = en;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          cur = fallback;
          break;
        }
      }
      let s =
        typeof cur === 'string'
          ? cur
          : typeof fallback === 'string'
            ? fallback
            : ((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? _k);
      if (opts) for (const [k, v] of Object.entries(opts)) s = s.replace(`{{${k}}}`, String(v));
      return s;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/useDirection', () => ({
  useDirection: () => ({ dir: 'ltr', isRtl: false }),
}));

const allMajors: SubMajor[] = majorsData.flatMap((c) => c.subMajors);
const verifiedMajor = allMajors.find((m) => m.id === 'computer-science')!;
const unverifiedMajor = allMajors.find((m) => !m.lastVerified)!;

describe('MajorModal content contract', () => {
  it('renders nothing when there is no selected major', () => {
    const { container } = render(
      <MajorModal isOpen onClose={() => {}} major={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps a verified major’s existing sections and copy', () => {
    render(<MajorModal isOpen onClose={() => {}} major={verifiedMajor} />);

    // Title (localized AR/EN name) + German name.
    expect(screen.getAllByText(verifiedMajor.nameEN).length).toBeGreaterThan(0);
    if (verifiedMajor.nameDE) expect(screen.getByText(verifiedMajor.nameDE)).toBeInTheDocument();

    // At-a-glance chips.
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Degree')).toBeInTheDocument();

    // Admission tiers + the Bagrut converter.
    expect(screen.getByText('Can I get in?')).toBeInTheDocument();
    expect(screen.getByText('Official requirement (Germany-wide / legal)')).toBeInTheDocument();
    expect(screen.getByText('University-specific requirement')).toBeInTheDocument();
    expect(screen.getByText('Darb guidance')).toBeInTheDocument();

    // Language, About, Careers, Arab-48 notes, Sources.
    expect(screen.getByText('Language requirements')).toBeInTheDocument();
    expect(screen.getByText('What you study & who it suits')).toBeInTheDocument();
    expect(screen.getByText('Career Opportunities in Germany')).toBeInTheDocument();
    expect(screen.getByText('Notes for Arab 48 Students')).toBeInTheDocument();
    expect(screen.getByText('Sources')).toBeInTheDocument();
  });

  it('suppresses verified-only sections for a major without verified data', () => {
    render(<MajorModal isOpen onClose={() => {}} major={unverifiedMajor} />);
    expect(screen.getAllByText(unverifiedMajor.nameEN).length).toBeGreaterThan(0);
    expect(screen.queryByText('Can I get in?')).not.toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('closes via the × button and via Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MajorModal isOpen onClose={onClose} major={verifiedMajor} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('locks background scroll while open', () => {
    // Radix Dialog uses react-remove-scroll, which locks the body via a
    // `data-scroll-locked` attribute + injected stylesheet (not inline style).
    const { unmount } = render(<MajorModal isOpen onClose={() => {}} major={verifiedMajor} />);
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
    unmount();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });
});
