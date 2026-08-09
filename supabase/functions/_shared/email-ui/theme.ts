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
 * Email assets are served as static files from the published Darb site over
 * HTTPS (public/email/*). No auth, no signed URLs, no per-send lookup.
 */
export const LOGO_URL = `${SITE_URL}/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png`
export const LOGO_WIDTH = 132

/** Contact — mirrors src/lib/contactConfig.ts */
export const SUPPORT_WHATSAPP_URL = 'https://api.whatsapp.com/message/IVC4VCAEJ6TBD1'
export const SUPPORT_PHONE = '050-736-8283'

/** Socials — mirrors src/components/landing/Footer.tsx */
export const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/darb_studyingermany/',
    icon: `${SITE_URL}/email/instagram.png`,
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@darb_studyingrmany',
    icon: `${SITE_URL}/email/tiktok.png`,
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/people/%D8%AF%D8%B1%D8%A8-%D9%84%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D8%A9-%D9%81%D9%8A-%D8%A7%D9%84%D9%85%D8%A7%D9%86%D9%8A%D8%A7/61557861907067/',
    icon: `${SITE_URL}/email/facebook.png`,
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
