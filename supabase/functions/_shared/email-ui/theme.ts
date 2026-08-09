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
 * `/email/*` was 404 until the next publish, which is what produced broken
 * image placeholders in delivered mail, so the logo points at the brand asset
 * that is already deployed under /lovable-uploads (verified HTTP 200,
 * image/png, public, no auth and no signed/expiring URL).
 */
export const LOGO_URL = `${SITE_URL}/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png`
export const LOGO_WIDTH = 132

/** Contact — mirrors src/lib/contactConfig.ts */
export const SUPPORT_WHATSAPP_URL = 'https://api.whatsapp.com/message/IVC4VCAEJ6TBD1'
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
