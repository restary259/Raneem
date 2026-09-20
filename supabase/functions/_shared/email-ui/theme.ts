/**
 * Darb Email Design System — tokens.
 *
 * Values mirror the website (src/index.css): navy primary, gold brand accent,
 * 0.5rem radius. Everything here is a plain constant: no network calls, no
 * database lookups, nothing that could slow email rendering down.
 */

/** Brand */
export const BRAND_NAME = 'Darb Study International'
export const BRAND_NAME_AR = 'درب للدراسة في ألمانيا'
export const SITE_URL = 'https://darb.agency'

/**
 * Email assets must be served from a URL that is already live in production.
 * Managed brand asset: public, stable, and shared with the website.
 */
export const LOGO_URL = `${SITE_URL}/__l5e/assets-v1/d24b5a0a-5de4-449f-b3b2-1709ca2a28c8/darb-logo.png`
export const LOGO_WIDTH = 132

/** Contact — mirrors src/lib/contactConfig.ts */
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/4917623790623'
export const SUPPORT_PHONE = '0507368283'

/**
 * Socials — text links only. Icon images were hosted on a path that is not yet
 * published, and remote-image blocking in Outlook/Gmail makes tiny icon images
 * unreliable anyway. Text links can never render as a broken image.
 */
export const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/darb_studyingermany/',
  },
  {
    name: 'TikTok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@darb_studyingrmany',
  },
  {
    name: 'Facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/people/%D8%AF%D8%B1%D8%A8-%D9%84%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D8%A9-%D9%81%D9%8A-%D8%A7%D9%84%D9%85%D8%A7%D9%86%D9%8A%D8%A7/61557861907067/',
  },
] as const

/** Colors — hex equivalents of the site's HSL tokens (email clients need hex). */
export const color = {
  navy: '#0f1b2d',
  navySoft: '#1c2b42',
  gold: '#f9b115',
  text: '#1a2230',
  textMuted: '#5b6472',
  textFaint: '#8a92a0',
  border: '#e4e7ec',
  surface: '#f7f8fa',
  white: '#ffffff',
  success: '#12724f',
  successSurface: '#e9f6f0',
  warning: '#8a5a00',
  warningSurface: '#fdf3e0',
  danger: '#a52121',
  dangerSurface: '#fbecec',
} as const

export const font = {
  family:
    "'Segoe UI', Tahoma, 'Helvetica Neue', Helvetica, Arial, 'Noto Naskh Arabic', sans-serif",
  size: { h1: '22px', body: '15px', small: '13px', tiny: '12px', label: '11px' },
} as const

export const radius = { card: '8px', button: '8px' } as const

export const CONTAINER_WIDTH = 600
