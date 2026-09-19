const ESCALATION_PATTERNS = [
  /\b(human|person|advisor|price|cost|fee|payment|pay|visa|legal|lawyer|guarantee|acceptance|deadline|timeline|uncertain|not sure)\b/iu,
  /سعر|تكلفة|دفع|فيزا|تأشيرة|قانون|محامي|موظف|إنسان|مستشار|قبول|ضمان|موعد|مش متأكد|غير متأكد/iu,
];

export function requiresAdvisorReview(text: string): boolean {
  return ESCALATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isInsideWhatsAppServiceWindow(lastInboundAt: string | null, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  const received = new Date(lastInboundAt).getTime();
  return Number.isFinite(received) && now.getTime() >= received && now.getTime() - received <= 24 * 60 * 60 * 1000;
}

export function requiresApprovedTemplate(lastInboundAt: string | null, now = new Date()): boolean {
  return !isInsideWhatsAppServiceWindow(lastInboundAt, now);
}
