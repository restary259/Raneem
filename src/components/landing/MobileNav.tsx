import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ChevronDown } from 'lucide-react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDirection } from '@/hooks/useDirection';

const MobileNav = () => {
  const { t } = useTranslation();
  const { dir, sheetSide, textAlign } = useDirection();
  const [open, setOpen] = useState(false);
  const [studyGermanyOpen, setStudyGermanyOpen] = useState(false);
  const [studyPathOpen, setStudyPathOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const close = () => setOpen(false);
  const groupClass = 'border-t pt-3 mt-1';
  const itemClass = 'text-sm font-medium hover:text-brand-strong transition-colors ' + textAlign + ' block py-2';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-none border-b-2 border-brand" aria-label={t('nav.more')}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={sheetSide} className="w-72 bg-background" dir={dir}>
        <nav className="flex flex-col gap-3 mt-6 overflow-y-auto max-h-[calc(100dvh-4rem)]">
          <div className="flex justify-center mb-3"><LanguageSwitcher /></div>

          <Collapsible open={studyGermanyOpen} onOpenChange={setStudyGermanyOpen} className={groupClass}>
            <CollapsibleTrigger className={'flex items-center justify-between w-full py-3 ' + textAlign}>
              <span className="text-sm font-semibold">{t('nav.studyGermany')}</span>
              <ChevronDown className={'h-4 w-4 text-gray-500 transition-transform duration-200 ' + (studyGermanyOpen ? 'rotate-180' : '')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
              <Link onClick={close} to="/educational-destinations" className={itemClass}>{t('nav.educationalDestinations')}</Link>
              <Link onClick={close} to="/educational-programs" className={itemClass}>{t('nav.majors')}</Link>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={studyPathOpen} onOpenChange={setStudyPathOpen} className={groupClass}>
            <CollapsibleTrigger className={'flex items-center justify-between w-full py-3 ' + textAlign}>
              <span className="text-sm font-semibold">{t('nav.studyPath')}</span>
              <ChevronDown className={'h-4 w-4 text-gray-500 transition-transform duration-200 ' + (studyPathOpen ? 'rotate-180' : '')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
              <Link onClick={close} to="/educational-programs" className={itemClass}>{t('nav.majors')}</Link>
              <Link onClick={close} to="/quiz" className={itemClass}>{t('nav.majorQuizNav')}</Link>
              <Link onClick={close} to="/ai-advisor" className={itemClass}>{t('nav.aiAdvisor')}</Link>
            </CollapsibleContent>
          </Collapsible>

          <Link onClick={close} to="/services" className={'border-y border-border py-3 text-sm font-semibold hover:text-brand-strong transition-colors ' + textAlign}>{t('nav.services')}</Link>

          <Collapsible open={resourcesOpen} onOpenChange={setResourcesOpen} className={groupClass}>
            <CollapsibleTrigger className={'flex items-center justify-between w-full py-3 ' + textAlign}>
              <span className="text-sm font-semibold">{t('nav.resources')}</span>
              <ChevronDown className={'h-4 w-4 text-gray-500 transition-transform duration-200 ' + (resourcesOpen ? 'rotate-180' : '')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
              <Link onClick={close} to="/resources" className={itemClass}>{t('nav.resources')}</Link>
              <Link onClick={close} to="/resources/bagrut-calculator" className={itemClass}>{t('nav.bagrutCalculator')}</Link>
              <Link onClick={close} to="/resources/cost-calculator" className={itemClass}>{t('nav.costCalculator')}</Link>
              <Link onClick={close} to="/resources/currency-converter" className={itemClass}>{t('nav.currencyConverter')}</Link>
              <Link onClick={close} to="/resources/lebenslauf-builder" className={itemClass}>{t('nav.cvBuilder')}</Link>
              <Link onClick={close} to="/faq" className={itemClass}>{t('nav.faq')}</Link>
              <Link onClick={close} to="/broadcast" className={itemClass}>{t('nav.broadcast')}</Link>
              <Link onClick={close} to="/blog" className={itemClass}>{t('nav.blog')}</Link>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={aboutOpen} onOpenChange={setAboutOpen} className={groupClass}>
            <CollapsibleTrigger className={'flex items-center justify-between w-full py-3 ' + textAlign}>
              <span className="text-sm font-semibold">{t('nav.aboutDarb')}</span>
              <ChevronDown className={'h-4 w-4 text-gray-500 transition-transform duration-200 ' + (aboutOpen ? 'rotate-180' : '')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
              <Link onClick={close} to="/about" className={itemClass}>{t('nav.about')}</Link>
              <Link onClick={close} to="/locations" className={itemClass}>{t('nav.locations')}</Link>
              <Link onClick={close} to="/partnership" className={itemClass}>{t('nav.partnership')}</Link>
            </CollapsibleContent>
          </Collapsible>

          <Link onClick={close} to="/contact" className={'text-sm font-medium contact-glow transition-colors ' + textAlign + ' py-3 border-y border-border'}>{t('nav.contact')}</Link>

          <Link onClick={close} to="/student-auth" className="bg-brand-strong text-brand-foreground px-3 py-2 rounded-lg font-medium hover:bg-brand-strong/90 transition-colors text-center mt-3 text-sm">{t('nav.studentLogin')}</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;