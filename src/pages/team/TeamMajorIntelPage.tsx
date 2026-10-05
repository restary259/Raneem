/**
 * Internal major lookup for the team: a search box, the subject list, and one
 * card per subject. Verified content only — subjects without it show an honest
 * empty card that is filled in manually over time.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from '@/lib/router-compat';
import { useTranslation } from 'react-i18next';
import { Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SUBJECTS, getSubject, searchSubjects, type SubjectEntry } from '@/lib/intel/subjects';
import MajorCard from '@/components/team/intel/MajorCard';

export default function TeamMajorIntelPage() {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  // The open subject is derived from the URL, so a refresh or a shared link
  // shows the same major and browser Back returns to the search list.
  const linkedMajorId = searchParams.get('major');
  const subject = useMemo(
    () => (linkedMajorId ? getSubject(linkedMajorId) ?? null : null),
    [linkedMajorId],
  );

  const open = useCallback(
    (entry: SubjectEntry) => {
      const next = new URLSearchParams(searchParams);
      next.set('major', entry.id);
      setSearchParams(next);
      window.scrollTo({ top: 0 });
    },
    [searchParams, setSearchParams],
  );

  const handleBack = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('major');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const results = useMemo(() => (query.trim() ? searchSubjects(query) : []), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SubjectEntry[]>();
    for (const entry of SUBJECTS) {
      const key = isAr ? entry.categoryAR : entry.categoryEN;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return Array.from(map.entries());
  }, [isAr]);

  const tile = (entry: SubjectEntry) => (
    <Button
      key={entry.id}
      type="button"
      variant="outline"
      onClick={() => open(entry)}
      className="h-auto w-full justify-between gap-2 rounded-md px-3 py-2.5 text-start"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{isAr ? entry.nameAR : entry.nameEN}</span>
        <span className="block truncate text-xs text-muted-foreground">{isAr ? entry.nameEN : entry.nameAR}</span>
      </span>
      {entry.intel?.status === 'verified' && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      {subject ? (
        <MajorCard subject={subject} onBack={handleBack} />
      ) : (
        <>
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="major-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 ps-9 text-base"
              placeholder={t('intel.searchPlaceholder', isAr ? 'ابحث عن تخصص…' : 'Search a major…')}
              aria-label={t('intel.search', 'Search a major')}
            />
          </div>

          {query.trim() ? (
            <section className="space-y-2">
              {results.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t('intel.noMatch', 'No major matches this search.')}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{results.map(tile)}</div>
              )}
            </section>
          ) : (
            <>
              {grouped.map(([category, entries], index) => (
                <section key={category} className={cn('space-y-2', index > 0 && 'pt-2')}>
                  <h2 className="text-xs font-semibold uppercase text-muted-foreground">{category}</h2>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{entries.map(tile)}</div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
