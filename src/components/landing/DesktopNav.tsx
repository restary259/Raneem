import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router-compat';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import ListItem from './ListItem';
import { useDirection } from '@/hooks/useDirection';

const DesktopNav = ({ transparent = false }: { transparent?: boolean }) => {
  const { t } = useTranslation();
  const { dir } = useDirection();

  const studyGermany = [
    { title: t('nav.educationalDestinations'), href: '/educational-destinations', description: t('nav.educationalDestinationsDesc') },
    { title: t('nav.majors'), href: '/educational-programs', description: t('seo.edProgDesc', { ns: 'common' }) },
  ];

  const studyPath = [
    { title: t('nav.majorQuizNav'), href: '/quiz', description: t('seo.quizDesc', { ns: 'common' }) },
    { title: t('nav.aiAdvisor'), href: '/ai-advisor', description: t('seo.advisorDesc', { ns: 'common' }) },
  ];

  const resources = [
    { title: t('nav.resources'), href: '/resources', description: t('seo.resourcesDesc', { ns: 'common' }) },
    { title: t('nav.faq'), href: '/faq', description: t('nav.faqDesc') },
    { title: t('nav.broadcast'), href: '/broadcast', description: t('nav.broadcastDesc') },
    { title: t('nav.blog'), href: '/blog', description: t('footer.blog') },
  ];

  const about = [
    { title: t('nav.about'), href: '/about', description: t('desktopNav.about.description') },
    { title: t('nav.locations'), href: '/locations', description: t('desktopNav.locations.description') },
    { title: t('nav.partnership'), href: '/partnership', description: t('desktopNav.partnership.description') },
  ];

  const renderDropdown = (items: { title: string; href: string; description: string }[], widthClass = 'md:w-[500px]') => (
    <NavigationMenuContent>
      <ul className={`grid w-[400px] gap-2 p-3 ${dir === "rtl" ? "text-right" : "text-left"} ${widthClass} rounded-md border border-border bg-background/95 shadow-surface-lg backdrop-blur-md`}>
        {items.map((item) => (
          <ListItem key={item.href} to={item.href} title={item.title}>
            {item.description}
          </ListItem>
        ))}
      </ul>
    </NavigationMenuContent>
  );

  const triggerClass = transparent
    ? 'nav-item rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:border-primary-foreground/15 hover:bg-primary-foreground/10 hover:text-primary-foreground data-[state=open]:border-brand/50 data-[state=open]:bg-primary-foreground/10'
    : 'nav-item rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-brand-strong data-[state=open]:border-brand/40 data-[state=open]:bg-muted';
  const linkClass = navigationMenuTriggerStyle() + (transparent
    ? ' nav-item rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:border-primary-foreground/15 hover:bg-primary-foreground/10 hover:text-primary-foreground'
    : ' nav-item rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-brand-strong');

  return (
    <div className="flex justify-center w-full" dir={dir}>
      <NavigationMenu>
        <NavigationMenuList className="flex items-stretch gap-1">
          <NavigationMenuItem>
            <NavigationMenuTrigger className={triggerClass}>{t('nav.studyGermany')}</NavigationMenuTrigger>
            {renderDropdown(studyGermany)}
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger className={triggerClass}>{t('nav.studyPath')}</NavigationMenuTrigger>
            {renderDropdown(studyPath)}
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={linkClass}>
              <Link to="/services">{t('nav.services')}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger className={triggerClass}>{t('nav.resources')}</NavigationMenuTrigger>
            {renderDropdown(resources, 'md:w-[600px] md:grid-cols-2 lg:w-[680px]')}
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger className={triggerClass}>{t('nav.aboutDarb')}</NavigationMenuTrigger>
            {renderDropdown(about)}
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={linkClass}>
              <Link to="/contact">{t('nav.contact')}</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

export default DesktopNav;