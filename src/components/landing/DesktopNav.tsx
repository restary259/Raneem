
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
      title: 'البرامج التعليمية',
      href: '/educational-programs',
      description: 'استكشف التخصصات الأكاديمية المختلفة واختر مسارك المهني',
    },
    {
      title: t('nav.partnership'),
      href: '/partnership',
      description: t('desktopNav.partnership.description'),
    },
    {
      title: 'وجهاتنا التعليمية',
      href: '/educational-destinations',
      description: 'اكتشف الجامعات ومعاهد اللغة والخدمات التعليمية',
    },
    {
      title: t('nav.broadcast'),
      href: '/broadcast',
      description: 'شاهد فيديوهات تعليمية ومباشرة من خبرائنا',
    }
  ];

  return (
    <NavigationMenu>
      <NavigationMenuList className="flex items-center gap-1">
        <NavigationMenuItem>
          <Link to="/">
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              {t('nav.home')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-gray-700 hover:text-orange-500 font-medium">
            {t('nav.about')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[500px] md:grid-cols-2 lg:w-[600px]">
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
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              {t('nav.services')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/educational-programs">
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              التخصصات
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-gray-700 hover:text-orange-500 font-medium">
            المزيد+
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 text-right md:w-[400px]">
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

        <NavigationMenuItem>
          <Link to="/quiz">
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              اختبار التخصص
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/resources">
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              {t('nav.resources')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link to="/contact">
            <NavigationMenuLink className={`${navigationMenuTriggerStyle()} text-gray-700 hover:text-orange-500 font-medium`}>
              {t('nav.contact')}
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default DesktopNav;
