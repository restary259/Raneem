import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router-compat';
import { Accessibility, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDirection } from '@/hooks/useDirection';

type FontSize = 'base' | 'lg' | 'xl';

interface AccessibilitySettings {
  fontSize: FontSize;
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  reduceMotion: boolean;
  bigCursor: boolean;
}

const STORAGE_KEY = 'darb-accessibility-settings';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: 'base',
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  reduceMotion: false,
  bigCursor: false,
};

const SETTING_CLASSES = [
  'a11y-font-lg',
  'a11y-font-xl',
  'a11y-high-contrast',
  'a11y-grayscale',
  'a11y-highlight-links',
  'a11y-readable-font',
  'a11y-reduce-motion',
  'a11y-big-cursor',
] as const;

function normaliseSettings(value: unknown): AccessibilitySettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;

  const candidate = value as Partial<AccessibilitySettings>;
  return {
    fontSize:
      candidate.fontSize === 'lg' || candidate.fontSize === 'xl'
        ? candidate.fontSize
        : 'base',
    highContrast: Boolean(candidate.highContrast),
    grayscale: Boolean(candidate.grayscale),
    highlightLinks: Boolean(candidate.highlightLinks),
    readableFont: Boolean(candidate.readableFont),
    reduceMotion: Boolean(candidate.reduceMotion),
    bigCursor: Boolean(candidate.bigCursor),
  };
}

function readSettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: AccessibilitySettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked in private/restricted browsing contexts.
  }
}

function applySettings(settings: AccessibilitySettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.remove(...SETTING_CLASSES);

  if (settings.fontSize === 'lg') root.classList.add('a11y-font-lg');
  if (settings.fontSize === 'xl') root.classList.add('a11y-font-xl');
  if (settings.highContrast) root.classList.add('a11y-high-contrast');
  if (settings.grayscale) root.classList.add('a11y-grayscale');
  if (settings.highlightLinks) root.classList.add('a11y-highlight-links');
  if (settings.readableFont) root.classList.add('a11y-readable-font');
  if (settings.reduceMotion) root.classList.add('a11y-reduce-motion');
  if (settings.bigCursor) root.classList.add('a11y-big-cursor');
}

const AccessibilityMenu = ({ className = '' }: { className?: string }) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useDirection();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = readSettings();
    setSettings(saved);
    applySettings(saved);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue
        ? normaliseSettings(JSON.parse(event.newValue))
        : DEFAULT_SETTINGS;
      setSettings(next);
      applySettings(next);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateSettings = (patch: Partial<AccessibilitySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      applySettings(next);
      persistSettings(next);
      return next;
    });
  };

  const setFontSize = (fontSize: FontSize) => updateSettings({ fontSize });

  const resetAll = () => {
    setSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked in private/restricted browsing contexts.
    }
  };

  const itemClass = cn(
    'min-h-11 py-2',
    isRtl && 'pl-2 pr-8 [&>span]:left-auto [&>span]:right-2',
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11 min-h-11 min-w-11 shrink-0', className)}
          aria-label={t('accessibilityMenu.trigger')}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Accessibility className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        dir={dir}
        side="bottom"
        align={isRtl ? 'start' : 'end'}
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1rem)] p-2"
      >
        <DropdownMenuLabel className={isRtl ? 'text-right' : 'text-left'}>
          {t('accessibilityMenu.textSize')}
        </DropdownMenuLabel>

        <DropdownMenuItem
          disabled={settings.fontSize === 'xl'}
          onSelect={() =>
            setFontSize(settings.fontSize === 'base' ? 'lg' : 'xl')
          }
          className="min-h-11 py-2"
        >
          <Plus className="mr-2 h-4 w-4 shrink-0 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
          {t('accessibilityMenu.increaseText')}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={settings.fontSize === 'base'}
          onSelect={() =>
            setFontSize(settings.fontSize === 'xl' ? 'lg' : 'base')
          }
          className="min-h-11 py-2"
        >
          <Minus className="mr-2 h-4 w-4 shrink-0 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
          {t('accessibilityMenu.decreaseText')}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={settings.fontSize === 'base'}
          onSelect={() => setFontSize('base')}
          className="min-h-11 py-2"
        >
          {t('accessibilityMenu.resetTextSize')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={settings.highContrast}
          onCheckedChange={(checked) => updateSettings({ highContrast: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.highContrast')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={settings.grayscale}
          onCheckedChange={(checked) => updateSettings({ grayscale: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.grayscale')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={settings.highlightLinks}
          onCheckedChange={(checked) => updateSettings({ highlightLinks: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.highlightLinks')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={settings.readableFont}
          onCheckedChange={(checked) => updateSettings({ readableFont: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.readableFont')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={settings.reduceMotion}
          onCheckedChange={(checked) => updateSettings({ reduceMotion: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.reduceMotion')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={settings.bigCursor}
          onCheckedChange={(checked) => updateSettings({ bigCursor: checked })}
          className={itemClass}
        >
          {t('accessibilityMenu.largeCursor')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={resetAll} className="min-h-11 py-2">
          <RotateCcw className="mr-2 h-4 w-4 shrink-0 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
          {t('accessibilityMenu.resetAll')}
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="min-h-11 py-2">
          <Link to="/accessibility">{t('accessibilityMenu.statement')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccessibilityMenu;
