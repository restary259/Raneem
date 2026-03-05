import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, CheckCircle2, Share2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useDirection } from "@/hooks/useDirection";

export default function PartnerLinkPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/student-auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  if (!userId) return <DashboardLoading />;

  const baseUrl = window.location.origin;
  const refLink = `${baseUrl}/apply?ref=${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      toast({ title: t("influencer.referralLink.copied", "Link copied!") });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "DARB Study Abroad", url: refLink });
    } else {
      handleCopy();
    }
  };

  const tips = [
    t("partner.tips.bio", "Add your referral link to your profile bio"),
    t("partner.tips.stories", "Share student success stories in your Stories"),
    t("partner.tips.hashtags", "Use hashtags like #StudyInGermany #دراسةفيألمانيا"),
    t("partner.tips.results", "Share real student results (with permission)"),
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          {t("partner.myLink", "My Referral Link")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            "influencer.referralLink.description",
            "Share this link. Students who apply through it are linked to your account.",
          )}
        </p>
      </div>

      {/* Link Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={refLink}
              readOnly
              className="font-mono text-sm bg-background"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="icon" variant="default" onClick={handleCopy} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              {t("partner.copyLink", "Copy Link")}
            </Button>
            <Button variant="default" className="flex-1 gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              {t("partner.shareLink", "Share")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">💡 {t("partner.tipsTitle", "Marketing Tips")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
