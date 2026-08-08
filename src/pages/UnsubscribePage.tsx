import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, MailX, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "done" | "invalid";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok && body?.valid !== false && !body?.error) setState("valid");
        else if (body?.already_unsubscribed) setState("done");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setBusy(false);
    setState(error ? "invalid" : "done");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-16">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">جارٍ التحقق…</p>
          </>
        )}
        {state === "valid" && (
          <>
            <MailX className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">إلغاء الاشتراك في رسائل البريد</h1>
            <p className="text-sm text-muted-foreground">
              لن تصلك بعد الآن إشعارات البريد من درب. يمكنك دائماً متابعة رسائلك من داخل لوحة التحكم.
            </p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد إلغاء الاشتراك"}
            </Button>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="text-xl font-semibold">تم إلغاء الاشتراك</h1>
            <p className="text-sm text-muted-foreground">لن نرسل لك رسائل بريد إلكتروني بعد الآن.</p>
          </>
        )}
        {state === "invalid" && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="text-xl font-semibold">الرابط غير صالح</h1>
            <p className="text-sm text-muted-foreground">
              انتهت صلاحية الرابط أو تم استخدامه مسبقاً.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
