import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ChevronDown, Mail, MessageCircle } from 'lucide-react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDirection } from '@/hooks/useDirection';
import { SUPPORT_EMAIL, whatsappBusinessUrl } from '@/lib/contactConfig';

const MobileNav = ({ transparent = false }: { transparent?: boolean }) => {
  const { t } = useTranslation();
  const { dir, sheetSide, textAlign } = useDirection();
  const [open, setOpen] = useState(false);
  const [studyGermanyOpen, setStudyGermanyOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const close = () => setOpen(false);
  const groupClass = 'border-t pt-3 mt-1';
  const itemClass = 'text-sm font-medium hover:text-brand-strong transition-colors ' + textAlign + ' block py-2';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className={`min-h-11 min-w-11 ${transparent ? "border-primary-foreground/50 bg-transparent text-primary-foreground drop-shadow-sm hover:bg-background/15 hover:text-primary-foreground" : "border-border bg-background"}`} aria-label={t('nav.more')}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={sheetSide} className="w-72 bg-background" dir={dir}>
        <nav className="flex flex-col gap-3 mt-6 overflow-y-auto max-h-[calc(100dvh-4rem)]">
          <div className="flex justify-center mb-3"><LanguageSwitcher /></div>

          <Link onClick={close} to="/apply" className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-4 text-center text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90">{t('nav.apply')}</Link>

          <Collapsible open={studyGermanyOpen} onOpenChange={setStudyGermanyOpen} className={groupClass}>
            <CollapsibleTrigger className={'flex items-center justify-between w-full py-3 ' + textAlign}>
              <span className="text-sm font-semibold">{t('nav.studyGermany')}</span>
              <ChevronDown className={'h-4 w-4 text-gray-500 transition-transform duration-200 ' + (studyGermanyOpen ? 'rotate-180' : '')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
              <Link onClick={close} to="/educational-destinations" className={itemClass}>{t('nav.educationalDestinations')}</Link>
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

          <div className="mt-2 grid gap-2 border-t border-border pt-4">
            <a href={whatsappBusinessUrl("مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex min-h-11 items-center gap-3 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary" dir="ltr">
              <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </div>

          <Link onClick={close} to="/student-auth" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-4 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">{t('nav.studentLogin')}</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;