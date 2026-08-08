/**
 * The single source of truth for the DARB service fee.
 *
 * The catalog row "رسوم الخدمة الأساسية" in `service_catalog` carries the live
 * value; this constant is the fallback used when the catalog cannot be read.
 * No component may hardcode the number.
 */
export const DEFAULT_SERVICE_FEE_ILS = 4000;

/** Number of months a 40-week course spans, used to spread one-off course fees. */
export const COURSE_MONTHS = (40 * 7) / 30.44;
