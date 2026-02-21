
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
import { useDirection } from '@/hooks/useDirection';

const DesktopNav = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();

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
  ];

  const moreComponents: { title: string; href: string; description: string }[] = [
    {
      title: t('nav.educationalDestinations'),
      href: '/educational-destinations',
      description: t('nav.educationalDestinationsDesc'),
    },
    {
      title: t('nav.partnership'),
      href: '/partnership',
      description: t('desktopNav.partnership.description'),
    },
    {
      title: t('nav.broadcast'),
      href: '/broadcast',
      description: t('nav.broadcastDesc'),
    },
  ];

  return (
    <div className="flex justify-center w-full" dir={dir}>
      <NavigationMenu>
        <NavigationMenuList className="flex items-center gap-1">
          {/* المزيد (dropdown) - First item */}
          <NavigationMenuItem>
            <NavigationMenuTrigger className="nav-item text-gray-700 hover:text-orange-500 font-medium">
              {t('nav.more')}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className={`grid w-[400px] gap-3 p-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} md:w-[400px] bg-white shadow-lg border rounded-md`}>
                {moreComponents.map((component) => (
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

          {/* تواصل معنا */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item contact-glow font-medium`}>
              <Link to="/contact">
                {t('nav.contact')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>

          {/* موارد */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
              <Link to="/resources">
                {t('nav.resources')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>

          {/* اختيار التخصص */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
              <Link to="/quiz">
                {t('nav.majorQuizNav')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>

          {/* التخصصات */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
              <Link to="/educational-programs">
                {t('nav.majors')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>

          {/* خدماتنا */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
              <Link to="/services">
                {t('nav.services')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>

          {/* من نحن (dropdown) */}
          <NavigationMenuItem>
            <NavigationMenuTrigger className="nav-item text-gray-700 hover:text-orange-500 font-medium">
              {t('nav.about')}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className={`grid w-[400px] gap-3 p-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} md:w-[500px] md:grid-cols-2 lg:w-[600px] bg-white shadow-lg border rounded-md`}>
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

          {/* الرئيسية - Last item */}
          <NavigationMenuItem>
            <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
              <Link to="/">
                {t('nav.home')}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

export default DesktopNav;
