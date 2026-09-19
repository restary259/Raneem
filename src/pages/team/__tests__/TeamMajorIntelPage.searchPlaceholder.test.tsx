import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/lib/router-compat';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dashboardAr from '../../../../public/locales/ar/dashboard.json';
import dashboardEn from '../../../../public/locales/en/dashboard.json';

/**
 * The Major Intelligence search box must prompt in the reader's own language.
 * It used to show a multilingual data sample ("Computer Science"), which reads
 * as prefilled content rather than a hint, so it is now a plain prompt.
 */

import TeamMajorIntelPage from '../TeamMajorIntelPage';

const initI18n = async (lng: 'ar' | 'en') => {
  await i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    ns: ['dashboard'],
    defaultNS: 'dashboard',
    resources: {
      ar: { dashboard: dashboardAr },
      en: { dashboard: dashboardEn },
    },
    interpolation: { escapeValue: false },
  });
  return i18n;
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <TeamMajorIntelPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
});

describe('TeamMajorIntelPage search placeholder', () => {
  it('prompts to search a major in English', async () => {
    await initI18n('en');
    renderPage();

    const input = screen.getByLabelText('Search a major');
    expect(input).toHaveAttribute('placeholder', 'Search a major…');
    expect(input.getAttribute('placeholder')).not.toMatch(/Computer Science/i);
  });

  it('prompts in Arabic when the dashboard is Arabic', async () => {
    await initI18n('ar');
    renderPage();

    const input = screen.getByLabelText('ابحث عن تخصص');
    expect(input).toHaveAttribute('placeholder', 'ابحث عن تخصص…');
    expect(input.getAttribute('placeholder')).not.toMatch(/Computer Science/i);
  });

  it('keeps the placeholder free of sample-major examples in both dictionaries', () => {
    for (const dict of [dashboardAr, dashboardEn]) {
      expect(dict.intel.searchPlaceholder).not.toMatch(/Computer Science|Informatik|علوم الحاسوب/);
    }
  });
});