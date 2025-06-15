
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu';
import ListItem from './ListItem';

const DesktopNav = () => {
  const { t } = useTranslation();

  const aboutComponents: { title: string; href: string; description: string }[] = [
    {
      title: t('nav.about'),
      href: '/about',
      description: 'تعرف على قصتنا ورؤيتنا وقيمنا.',
    },
    {
      title: t('nav.locations'),
      href: '/locations',
      description: 'اكتشف مواقع مكاتبنا حول العالم.',
    },
    {
      title: t('nav.testimonials'),
      href: '/testimonials',
      description: 'اقرأ قصص نجاح طلابنا الملهمة.',
    },
  ];

  const partnershipComponents: { title: string; href: string; description: string }[] = [
    {
        title: t('nav.partnership'),
        href: '/partnership',
        description: 'انضم إلى شبكتنا كشريك أو مؤثر.',
    },
    {
        title: t('nav.partners'),
        href: '/partners',
        description: 'تصفح قائمة شركائنا المعتمدين.',
    }
  ];

  return (
    <NavigationMenu>
      <NavigationMenuList className="flex-row-reverse">
        <NavigationMenuItem>
          <Link to="/">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.home')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>{t('nav.about')}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {aboutComponents.map((component) => (
                <ListItem
                  key={component.title}
                  to={component.href}
                  title={component.title}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
          <Link to="/services">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.services')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
          <Link to="/broadcast">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {'بث دارب'}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
            <NavigationMenuTrigger>{t('nav.partnership')}</NavigationMenuTrigger>
            <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[400px]">
                    {partnershipComponents.map((component) => (
                        <ListItem
                        key={component.title}
                        to={component.href}
                        title={component.title}
                        >
                        {component.description}
                        </ListItem>
                    ))}
                </ul>
            </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/resources">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.resources')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/contact">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.contact')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default DesktopNav;
