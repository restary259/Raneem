
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
    {
      title: t('housing.title', 'Student Housing'),
      href: '/housing',
      description: t('housing.heroSubtitle', 'Find your perfect accommodation'),
    }
  ];

  return (
    <div className="flex justify-center w-full" dir={dir}>
      <NavigationMenu>
        <NavigationMenuList className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
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
            <Link to="/contact">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.contact')}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>

          {/* موارد */}
          <NavigationMenuItem>
            <Link to="/resources">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.resources')}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>

          {/* اختيار التخصص */}
          <NavigationMenuItem>
            <Link to="/quiz">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.majorQuizNav')}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>

          {/* التخصصات */}
          <NavigationMenuItem>
            <Link to="/educational-programs">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.majors')}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>

          {/* خدماتنا */}
          <NavigationMenuItem>
            <Link to="/services">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.services')}
              </NavigationMenuLink>
            </Link>
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
            <Link to="/">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                {t('nav.home')}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

export default DesktopNav;
