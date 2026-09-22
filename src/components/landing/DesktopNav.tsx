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
    ? 'nav-item relative rounded-none border-0 bg-transparent px-2 py-2 text-xs font-semibold xl:px-3 xl:text-sm text-primary-foreground drop-shadow-sm after:absolute after:inset-x-2 after:bottom-0 xl:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-brand after:transition-transform hover:bg-transparent hover:text-primary-foreground hover:after:scale-x-100 data-[state=open]:bg-transparent data-[state=open]:after:scale-x-100'
    : 'nav-item relative rounded-none border-0 bg-transparent px-2 py-2 text-xs font-semibold xl:px-3 xl:text-sm text-foreground after:absolute after:inset-x-2 after:bottom-0 xl:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-brand after:transition-transform hover:bg-transparent hover:text-primary hover:after:scale-x-100 data-[state=open]:bg-transparent data-[state=open]:after:scale-x-100';
  const linkClass = navigationMenuTriggerStyle() + (transparent
    ? ' nav-item relative rounded-none border-0 bg-transparent px-2 py-2 text-xs font-semibold xl:px-3 xl:text-sm text-primary-foreground drop-shadow-sm after:absolute after:inset-x-2 after:bottom-0 xl:inset-x-3 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-brand after:transition-transform hover:bg-transparent hover:text-primary-foreground hover:after:scale-x-100'
    : ' nav-item relative rounded-none border-0 bg-transparent px-2 py-2 text-xs font-semibold xl:px-3 xl:text-sm text-foreground after:absolute after:inset-x-2 after:bottom-0 xl:inset-x-3 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-brand after:transition-transform hover:bg-transparent hover:text-primary hover:after:scale-x-100');

  return (
    <div className="flex min-w-0 w-full justify-center overflow-visible" dir={dir}>
      <NavigationMenu className="w-full max-w-full">
        <NavigationMenuList className="flex w-full min-w-0 max-w-full items-stretch justify-center gap-0 xl:gap-1">
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