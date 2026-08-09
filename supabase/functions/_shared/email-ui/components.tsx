/// <reference types="npm:@types/react@18.3.1" />
/**
 * Darb Email Design System — reusable presentational components.
 *
 * Pure render-time components: inline styles only, table-based where it
 * matters, no external CSS, no JS, no tracking, no runtime data fetching.
 */
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  BRAND_NAME,
  BRAND_NAME_AR,
  CONTAINER_WIDTH,
  LOGO_URL,
  LOGO_WIDTH,
  SITE_URL,
  SOCIAL_LINKS,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP_URL,
  color,
  font,
  radius,
} from './theme.ts'

type Dir = 'rtl' | 'ltr'

const isRtl = (dir: Dir) => dir === 'rtl'

/* ------------------------------------------------------------------ header */

export const EmailHeader = ({ dir = 'rtl' as Dir }) => (
  <Section style={headerSection}>
    <Link href={SITE_URL}>
      <Img
        src={LOGO_URL}
        alt={isRtl(dir) ? 'درب للدراسة في ألمانيا' : 'Darb Study International'}
        width={LOGO_WIDTH}
        style={logoStyle}
      />
    </Link>
    <Text style={brandLine}>{isRtl(dir) ? BRAND_NAME_AR : BRAND_NAME}</Text>
    <div style={goldRule} />
  </Section>
)

/* ------------------------------------------------------------------ footer */

export const EmailSocialLinks = () => (
  <Section style={{ textAlign: 'center', padding: '4px 0 12px' }}>
    {SOCIAL_LINKS.map((s, i) => (
      <React.Fragment key={s.name}>
        {i > 0 ? <span style={socialSep}>·</span> : null}
        <Link href={s.href} style={socialLink} title={s.name}>
          {s.label}
        </Link>
      </React.Fragment>
    ))}
  </Section>
)

export const EmailFooter = ({ dir = 'rtl' as Dir }) => {
  const rtl = isRtl(dir)
  return (
    <Section style={footerSection}>
      <Hr style={hr} />
      <EmailSocialLinks />
      <Text style={footerBrand}>{rtl ? BRAND_NAME_AR : BRAND_NAME}</Text>
      <Text style={footerLine}>
        <Link href={SITE_URL} style={footerLink}>
          darb.agency
        </Link>
        {'  ·  '}
        <Link href={SUPPORT_WHATSAPP_URL} style={footerLink}>
          {rtl ? 'واتساب الدعم' : 'WhatsApp support'}
        </Link>
        {'  ·  '}
        <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{SUPPORT_PHONE}</span>
      </Text>
      <Text style={footerFine}>
        {rtl
          ? 'هذه رسالة خدمة متعلقة بحسابك أو بملفك لدى درب.'
          : 'This is a service message related to your Darb account or case.'}
      </Text>
    </Section>
  )
}

/* ------------------------------------------------------------------ layout */

interface LayoutProps {
  dir?: Dir
  lang?: string
  preview: string
  title: string
  children: React.ReactNode
}

export const EmailLayout = ({
  dir = 'rtl',
  lang = 'ar',
  preview,
  title,
  children,
}: LayoutProps) => (
  <Html lang={lang} dir={dir}>
    <Head>
      <meta charSet="utf-8" />
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ ...bodyStyle, textAlign: isRtl(dir) ? 'right' : 'left' }}>
      <Container style={container}>
        <EmailHeader dir={dir} />
        <Section style={contentSection}>
          <Heading as="h1" style={h1}>
            {title}
          </Heading>
          {children}
        </Section>
        <EmailFooter dir={dir} />
      </Container>
    </Body>
  </Html>
)

/* ----------------------------------------------------------------- content */

export const EmailText = ({
  children,
  muted = false,
}: {
  children: React.ReactNode
  muted?: boolean
}) => <Text style={muted ? textMuted : text}>{children}</Text>

export const EmailButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Section style={{ padding: '8px 0 4px' }}>
    <Button href={href} style={button}>
      {children}
    </Button>
  </Section>
)

export const EmailCard = ({ children }: { children: React.ReactNode }) => (
  <Section style={card}>{children}</Section>
)

export const EmailInfoRow = ({
  label,
  value,
  ltrValue = false,
}: {
  label: string
  value: React.ReactNode
  ltrValue?: boolean
}) => (
  <Row style={{ marginBottom: '10px' }}>
    <Column>
      <Text style={infoLabel}>{label}</Text>
      <Text style={ltrValue ? { ...infoValue, direction: 'ltr' as const } : infoValue}>
        {value}
      </Text>
    </Column>
  </Row>
)

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const TONE_STYLE: Record<Tone, { bg: string; fg: string; mark: string }> = {
  neutral: { bg: color.surface, fg: color.textMuted, mark: '•' },
  success: { bg: color.successSurface, fg: color.success, mark: '✓' },
  warning: { bg: color.warningSurface, fg: color.warning, mark: '!' },
  danger: { bg: color.dangerSurface, fg: color.danger, mark: '×' },
}

/**
 * Status is always communicated by its text label plus a shape marker, never
 * by colour alone (accessibility + colour-blind safety).
 */
export const EmailStatusBadge = ({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: Tone
}) => {
  const t = TONE_STYLE[tone]
  return (
    <Text style={{ ...badge, backgroundColor: t.bg, color: t.fg, borderColor: t.fg }}>
      {t.mark} {label}
    </Text>
  )
}

/** Fallback link shown under a CTA, so the email works when buttons are stripped. */
export const EmailFallbackLink = ({ href, dir = 'rtl' as Dir }) => (
  <Text style={fallback}>
    {isRtl(dir)
      ? 'إذا لم يعمل الزر، انسخ هذا الرابط في المتصفح:'
      : 'If the button does not work, copy this link into your browser:'}
    <br />
    <Link href={href} style={{ ...footerLink, direction: 'ltr', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
      {href}
    </Link>
  </Text>
)

/* ------------------------------------------------------------------ styles */

const bodyStyle = {
  backgroundColor: color.white,
  margin: '0',
  padding: '0',
  fontFamily: font.family,
  color: color.text,
}

const container = {
  width: '100%',
  maxWidth: `${CONTAINER_WIDTH}px`,
  margin: '0 auto',
  padding: '0',
}

const headerSection = {
  padding: '28px 28px 0',
  textAlign: 'center' as const,
}

const logoStyle = {
  display: 'block',
  margin: '0 auto',
  maxWidth: '100%',
  height: 'auto',
}

const brandLine = {
  margin: '10px 0 0',
  fontSize: font.size.small,
  letterSpacing: '0.02em',
  color: color.textMuted,
  textAlign: 'center' as const,
}

const goldRule = {
  width: '44px',
  height: '3px',
  backgroundColor: color.gold,
  borderRadius: '2px',
  margin: '16px auto 0',
}

const contentSection = {
  padding: '24px 28px 8px',
}

const h1 = {
  margin: '0 0 14px',
  fontSize: font.size.h1,
  lineHeight: '1.4',
  fontWeight: 700 as const,
  color: color.navy,
}

const text = {
  margin: '0 0 12px',
  fontSize: font.size.body,
  lineHeight: '1.75',
  color: color.text,
}

const textMuted = {
  ...text,
  fontSize: font.size.small,
  color: color.textMuted,
}

const card = {
  backgroundColor: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
  padding: '16px 18px',
  margin: '16px 0',
}

const infoLabel = {
  margin: '0 0 2px',
  fontSize: font.size.label,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: color.textFaint,
}

const infoValue = {
  margin: '0',
  fontSize: font.size.body,
  fontWeight: 600 as const,
  color: color.text,
}

const badge = {
  display: 'inline-block',
  margin: '0',
  padding: '6px 12px',
  borderRadius: '999px',
  border: '1px solid',
  fontSize: font.size.small,
  fontWeight: 600 as const,
}

const button = {
  display: 'inline-block',
  backgroundColor: color.navy,
  color: color.white,
  fontSize: '15px',
  fontWeight: 700 as const,
  textDecoration: 'none',
  borderRadius: radius.button,
  padding: '14px 26px',
  minWidth: '180px',
  textAlign: 'center' as const,
}

const fallback = {
  margin: '10px 0 0',
  fontSize: font.size.tiny,
  lineHeight: '1.7',
  color: color.textFaint,
}

const footerSection = {
  padding: '4px 28px 28px',
  textAlign: 'center' as const,
}

const hr = {
  borderColor: color.border,
  margin: '20px 0 16px',
}

const footerBrand = {
  margin: '0 0 4px',
  fontSize: font.size.small,
  fontWeight: 700 as const,
  color: color.navy,
  textAlign: 'center' as const,
}

const footerLine = {
  margin: '0 0 8px',
  fontSize: font.size.tiny,
  color: color.textMuted,
  textAlign: 'center' as const,
}

const footerFine = {
  margin: '0',
  fontSize: font.size.tiny,
  lineHeight: '1.6',
  color: color.textFaint,
  textAlign: 'center' as const,
}

const footerLink = {
  color: color.navySoft,
  textDecoration: 'underline',
}

const socialLink = {
  display: 'inline-block',
  margin: '0 6px',
  color: color.textMuted,
  fontSize: '12px',
  textDecoration: 'none',
}

const socialSep = {
  color: color.textFaint,
  fontSize: '12px',
}
