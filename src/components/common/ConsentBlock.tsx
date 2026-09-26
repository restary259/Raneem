import { useId, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConsentBlockProps {
  isAr: boolean;
  /** What the form collects, in plain language (e.g. "الاسم، رقم الهاتف..."). */
  collected: string;
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  marketing?: boolean;
  onMarketingChange?: (v: boolean) => void;
  /** Hide the optional marketing consent (e.g. the agent application form). */
  showMarketing?: boolean;
  /** Override the "what we do with it" sentence for non-student forms. */
  purpose?: ReactNode;
  /** Override the required-consent checkbox label. */
  agreeLabel?: ReactNode;
  /** Validation message rendered under the required checkbox. */
  error?: string | null;
  /** Compact label for the expandable data-collection details. */
  detailsLabel?: ReactNode;
}

/**
 * Point-of-collection privacy notice + separate service / marketing consents.
 * Required consent gates submission; marketing consent is always optional.
 */
const ConsentBlock = ({
  isAr,
  collected,
  agreed,
  onAgreedChange,
  marketing = false,
  onMarketingChange,
  showMarketing = true,
  purpose,
  agreeLabel,
  error,
  detailsLabel,
}: ConsentBlockProps) => {
  const { i18n } = useTranslation();
  const isHe = i18n.language === "he";
  const agreeId = useId();
  const marketingId = useId();
  const errorId = `${agreeId}-error`;

  const privacyLink = (
    <Link to="/privacy" className="underline font-medium text-foreground">
      {isAr ? "سياسة الخصوصية" : isHe ? "מדיניות פרטיות" : "Privacy Policy"}
    </Link>
  );
  const termsLink = (
    <Link to="/terms" className="underline font-medium text-foreground">
      {isAr ? "شروط الخدمة" : isHe ? "תנאי שימוש" : "Terms of Service"}
    </Link>
  );

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span>{detailsLabel ?? (isAr ? "ما البيانات التي نجمعها؟" : isHe ? "אילו נתונים אנחנו אוספים?" : "What data do we collect?")}</span>
          <span className="ms-auto text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {purpose ? purpose : isAr ? (
              <>نجمع منك: {collected}. نستخدم هذه المعلومات لتقييم طلبك ومتابعته معك، وعند الحاجة لمشاركة المعلومات اللازمة مع الجهة المرتبطة بطلبك. لا نبيع بياناتك. راجع {privacyLink} و{termsLink} للمزيد.</>
            ) : isHe ? (
              <>אנחנו אוספים: {collected}. המידע משמש לבדיקת הבקשה ולמעקב מולכם, ובמידת הצורך לשיתוף המידע הנדרש עם הגורם הקשור לבקשה. איננו מוכרים את המידע. ראו {privacyLink} ו-{termsLink} לפרטים.</>
            ) : (
              <>We collect: {collected}. This is used to assess and follow up on your application and, where necessary, share required information with the party connected to your case. We do not sell your data. See {privacyLink} and {termsLink} for details.</>
            )}
          </p>
        </div>
      </details>

      <label htmlFor={agreeId} className="flex items-start gap-2.5 cursor-pointer">
        <input id={agreeId} type="checkbox" checked={agreed} onChange={(e) => onAgreedChange(e.target.checked)} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-[hsl(var(--accent))]" />
        <span className="text-sm leading-relaxed text-foreground">
          {agreeLabel ?? (isAr ? "أوافق على معالجة بياناتي والتواصل معي بخصوص طلبي. *" : isHe ? "אני מסכים/ה לעיבוד המידע שלי וליצירת קשר בנוגע לבקשה. *" : "I agree to my data being processed and to being contacted about my application. *")}
        </span>
      </label>

      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}

      {showMarketing && onMarketingChange ? (
        <label htmlFor={marketingId} className="flex items-start gap-2.5 cursor-pointer">
          <input id={marketingId} type="checkbox" checked={marketing} onChange={(e) => onMarketingChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-[hsl(var(--accent))]" />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {isAr ? "اختياري: أرغب باستلام نصائح وعروض ومواعيد تسجيل عبر البريد أو واتساب." : isHe ? "אופציונלי: אשמח לקבל טיפים, הצעות ומועדי הרשמה באימייל או ב-WhatsApp." : "Optional: send me tips, offers and intake deadlines by email or WhatsApp."}
          </span>
        </label>
      ) : null}
    </div>
  );};

export default ConsentBlock;
