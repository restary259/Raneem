
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
      description: t('desktopNav.about.description'),
    },
    {
      title: t('nav.locations'),
      href: '/locations',
      description: t('desktopNav.locations.description'),
    },
    {
      title: t('nav.testimonials'),
      href: '/testimonials',
      description: t('desktopNav.testimonials.description'),
    },
  ];

  const partnershipComponents: { title: string; href: string; description: string }[] = [
    {
        title: t('nav.partnership'),
        href: '/partnership',
        description: t('desktopNav.partnership.description'),
    },
    {
        title: t('nav.partners'),
        href: '/partners',
        description: t('desktopNav.partners.description'),
    }
  ];

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <Link to="/contact">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.contact')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/resources">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.resources')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
            <NavigationMenuTrigger>{t('nav.partnership')}</NavigationMenuTrigger>
            <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[400px]">
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
          <Link to="/broadcast">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.broadcast')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/services">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.services')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>{t('nav.about')}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
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
          <Link to="/">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              {t('nav.home')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default DesktopNav;
