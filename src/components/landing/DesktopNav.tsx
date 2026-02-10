
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
  ];

  const moreComponents: { title: string; href: string; description: string }[] = [
    {
      title: 'وجهاتنا التعليمية',
      href: '/educational-destinations',
      description: 'اكتشف الجامعات ومعاهد اللغة والخدمات التعليمية',
    },
    {
      title: t('nav.partnership'),
      href: '/partnership',
      description: t('desktopNav.partnership.description'),
    },
    {
      title: t('nav.broadcast'),
      href: '/broadcast',
      description: 'شاهد فيديوهات تعليمية ومباشرة من خبرائنا',
    }
  ];

  return (
    <div className="flex justify-center w-full" dir="rtl">
      <NavigationMenu>
        <NavigationMenuList className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {/* المزيد (dropdown) - First item */}
          <NavigationMenuItem>
            <NavigationMenuTrigger className="nav-item text-gray-700 hover:text-orange-500 font-medium">
              المزيد
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[400px] bg-white shadow-lg border rounded-md">
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
                اختيار التخصص
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>

          {/* التخصصات */}
          <NavigationMenuItem>
            <Link to="/educational-programs">
              <NavigationMenuLink className={`${navigationMenuTriggerStyle()} nav-item text-gray-700 hover:text-orange-500 font-medium`}>
                التخصصات
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
              <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[500px] md:grid-cols-2 lg:w-[600px] bg-white shadow-lg border rounded-md">
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
