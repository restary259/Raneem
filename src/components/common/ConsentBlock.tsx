import { useId } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

interface ConsentBlockProps {
  isAr: boolean;
  /** What the form collects, in plain language (e.g. "الاسم، رقم الهاتف..."). */
  collected: string;
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  marketing: boolean;
  onMarketingChange: (v: boolean) => void;
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
  marketing,
  onMarketingChange,
}: ConsentBlockProps) => {
  const agreeId = useId();
  const marketingId = useId();

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {isAr ? (
            <>
              نجمع منك: {collected}. نستخدم هذه المعلومات فقط لتقييم طلبك ومتابعته معك، ونشاركها عند
              الحاجة مع الجامعة أو مزوّد التأمين أو السكن المرتبط بطلبك. لا نبيع بياناتك لأي جهة.
              للتفاصيل الكاملة راجع{" "}
              <Link to="/privacy" className="underline font-medium text-foreground">
                سياسة الخصوصية
              </Link>{" "}
              و
              <Link to="/terms" className="underline font-medium text-foreground">
                شروط الخدمة
              </Link>
              . يمكنك سحب موافقتك أو طلب حذف بياناتك في أي وقت.
            </>
          ) : (
            <>
              We collect: {collected}. This is used only to assess and follow up on your application,
              and is shared where needed with the university, insurer or accommodation provider linked
              to your case. We never sell your data. See our{" "}
              <Link to="/privacy" className="underline font-medium text-foreground">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="underline font-medium text-foreground">
                Terms of Service
              </Link>
              . You can withdraw consent or request deletion at any time.
            </>
          )}
        </p>
      </div>

      <label htmlFor={agreeId} className="flex items-start gap-2.5 cursor-pointer">
        <input
          id={agreeId}
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--accent))]"
        />
        <span className="text-xs text-foreground">
          {isAr
            ? "أوافق على معالجة بياناتي وعلى تواصل فريق درب معي بخصوص طلبي. *"
            : "I agree to my data being processed and to Darb contacting me about my application. *"}
        </span>
      </label>

      <label htmlFor={marketingId} className="flex items-start gap-2.5 cursor-pointer">
        <input
          id={marketingId}
          type="checkbox"
          checked={marketing}
          onChange={(e) => onMarketingChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--accent))]"
        />
        <span className="text-xs text-muted-foreground">
          {isAr
            ? "اختياري: أرغب باستلام نصائح وعروض ومواعيد تسجيل عبر البريد أو واتساب."
            : "Optional: send me tips, offers and intake deadlines by email or WhatsApp."}
        </span>
      </label>
    </div>
  );
};

export default ConsentBlock;
