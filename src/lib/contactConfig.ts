/**
 * Centralized contact configuration.
 * All WhatsApp links and contact details should be imported from here.
 *
 * One canonical DARB business number is used for every public touchpoint
 * (hero, floating button, contact page, offices, student overview, broadcast,
 * email footer). The community group is a separate, clearly-labelled channel.
 */

/**
 * The single customer-facing DARB WhatsApp Business number (digits only).
 * This is the number authorised on the WhatsApp Business connection
 * (+49 176 23790623) — incoming replies land in the staff WhatsApp inbox.
 */
export const WHATSAPP_BUSINESS_NUMBER = "4917623790623";

/** Canonical WhatsApp link — use this for every public "message us" action. */
export const WHATSAPP_BUSINESS_URL = `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}`;

/** Deprecated aliases kept so existing imports resolve to the canonical number. */
export const WHATSAPP_SUPPORT_URL = WHATSAPP_BUSINESS_URL;
export const WHATSAPP_PHONE_URL = WHATSAPP_BUSINESS_URL;

/** WhatsApp community group link (community only — never customer support) */
export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo";

/** Support email */
export const SUPPORT_EMAIL = "darbsocial27@gmail.com";

/** Support phone number */
export const SUPPORT_PHONE = "0507368283";
