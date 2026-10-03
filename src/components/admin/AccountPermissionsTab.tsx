import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { MemberRow } from "./MemberList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Users,
  Phone,
  CalendarClock,
  Link2,
  FileText,
  Send,
  KeyRound,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import ProfileFeatureToggle from "./ProfileFeatureToggle";
import VoiceCallsToggle from "./VoiceCallsToggle";
import ReassignAppointmentsToggle from "./ReassignAppointmentsToggle";
import AgentInviteToggle from "./AgentInviteToggle";
import AgentCreateAccountsToggle from "./AgentCreateAccountsToggle";
import AgentParentToggle from "./AgentParentToggle";
import ReferralLinkToggle from "./ReferralLinkToggle";
import ApplyFormToggle from "./ApplyFormToggle";

interface Props {
  member: MemberRow;
  onChanged?: () => void;
  /** Opens the shared deactivate confirmation (owned by the drawer). */
  onDeactivate: () => void;
  /** Reports the active-permission count so the tab trigger can badge it. */
  onActiveCountChange?: (count: number) => void;
}

interface Flags {
  whatsappInbox: boolean;
  internalTeamChat: boolean;
  voiceCalls: boolean;
  reassignAppointments: boolean;
  referralLink: boolean;
  applyForm: boolean;
  agentInvite: boolean;
  agentCreateAccounts: boolean;
  agentId: string | null;
}

const EMPTY_FLAGS: Flags = {
  whatsappInbox: false,
  internalTeamChat: false,
  voiceCalls: false,
  reassignAppointments: false,
  referralLink: false,
  applyForm: false,
  agentInvite: false,
  agentCreateAccounts: false,
  agentId: null,
};

/** Every per-profile flag the permissions tab can own, read in one round trip. */
const FLAG_SELECT = [
  "whatsapp_inbox_enabled",
  "internal_team_chat_enabled",
  "voice_calls_enabled",
  "can_reassign_office_appointments",
  "referral_code_enabled",
  "apply_form_enabled",
  "agent_can_invite_directly",
  "agent_can_create_accounts",
  "agent_id",
].join(", ");

function PermissionRow({
  icon: Icon,
  title,
  description,
  control,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  control: React.ReactNode;
  tone?: "primary" | "emerald" | "brand";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    brand: "bg-brand/10 text-brand",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function PermissionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * The single control room for every switch attached to an account. One
 * profiles read hydrates all role-scoped flags; each flag is still written by
 * its atomic toggle component, so confirmation popups, audit logging and
 * optimistic updates are unchanged. Sections render per role:
 *   team_member      -> communication + operations
 *   agent            -> communication + growth + network
 *   partner/ambassador -> communication + growth + recruiting parent
 */
const AccountPermissionsTab: React.FC<Props> = ({
  member,
  onChanged,
  onDeactivate,
  onActiveCountChange,
}) => {
  const { t } = useTranslation("dashboard");
  const [flags, setFlags] = useState<Flags>(EMPTY_FLAGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  const isTeam = member.role === "team_member";
  const isAgent = member.role === "agent";
  const isRecruit =
    member.role === "social_media_partner" || member.role === "ambassador";

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setLoadError(false);
    setFlags(EMPTY_FLAGS);

    const load = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(FLAG_SELECT)
        .eq("id", member.requester_id)
        .maybeSingle();

      if (stale) return;
      if (error) {
        console.error("Failed to load account permissions:", error);
        setLoadError(true);
        setLoading(false);
        return;
      }

      const row = (data ?? {}) as Record<string, unknown>;
      setFlags({
        whatsappInbox: !!row.whatsapp_inbox_enabled,
        internalTeamChat: !!row.internal_team_chat_enabled,
        voiceCalls: !!row.voice_calls_enabled,
        reassignAppointments: !!row.can_reassign_office_appointments,
        referralLink: !!row.referral_code_enabled,
        applyForm: !!row.apply_form_enabled,
        agentInvite: !!row.agent_can_invite_directly,
        agentCreateAccounts: !!row.agent_can_create_accounts,
        agentId: (row.agent_id as string | null) ?? null,
      });
      setLoading(false);
    };

    void load();
    return () => {
      stale = true;
    };
  }, [member.requester_id, retry]);

  const activeCount = (() => {
    if (isTeam) {
      return [
        flags.whatsappInbox,
        flags.internalTeamChat,
        flags.voiceCalls,
        flags.reassignAppointments,
      ].filter(Boolean).length;
    }
    if (isAgent) {
      return [
        flags.voiceCalls,
        flags.referralLink,
        flags.applyForm,
        flags.agentInvite,
        flags.agentCreateAccounts,
      ].filter(Boolean).length;
    }
    if (isRecruit) {
      return [
        flags.voiceCalls,
        flags.referralLink,
        flags.applyForm,
        !!flags.agentId,
      ].filter(Boolean).length;
    }
    return [flags.voiceCalls].filter(Boolean).length;
  })();

  useEffect(() => {
    if (!loading) onActiveCountChange?.(activeCount);
  }, [activeCount, loading, onActiveCountChange]);

  const update = useCallback(
    (patch: Partial<Flags>) => setFlags((prev) => ({ ...prev, ...patch })),
    [],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {t(
            "admin.members.permissionsLoadError",
            "Couldn't load this account's permissions.",
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRetry((n) => n + 1)}
        >
          {t("common.retry", "Retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Communication & Messaging */}
      <PermissionGroup
        title={t(
          "admin.members.groupCommunication",
          "Communication & Messaging",
        )}
      >
        {isTeam && (
          <PermissionRow
            icon={MessageCircle}
            tone="emerald"
            title={t("admin.members.whatsappInboxTitle", "WhatsApp inbox")}
            description={t(
              "admin.members.whatsappInboxDesc",
              "Allow this team member to access the shared WhatsApp chat box.",
            )}
            control={
              <ProfileFeatureToggle
                userId={member.requester_id}
                column="whatsapp_inbox_enabled"
                label={t("admin.members.whatsappInboxTitle", "WhatsApp inbox")}
                value={flags.whatsappInbox}
                onChanged={(next) => update({ whatsappInbox: next })}
                enableTitle={t(
                  "admin.members.whatsappInboxEnableTitle",
                  "Enable WhatsApp inbox?",
                )}
                enableBody={t("admin.members.whatsappInboxEnableBody", {
                  name: member.full_name,
                  defaultValue:
                    "{{name}} will be able to open the shared WhatsApp inbox and message assigned or unassigned conversations.",
                })}
                disableTitle={t(
                  "admin.members.whatsappInboxDisableTitle",
                  "Disable WhatsApp inbox?",
                )}
                disableBody={t("admin.members.whatsappInboxDisableBody", {
                  name: member.full_name,
                  defaultValue:
                    "{{name}} will no longer see the shared WhatsApp inbox. They can still use the WhatsApp button from a case profile to open that case's attached number.",
                })}
                enabledToast={t(
                  "admin.members.whatsappInboxEnabled",
                  "WhatsApp inbox enabled",
                )}
                disabledToast={t(
                  "admin.members.whatsappInboxDisabled",
                  "WhatsApp inbox disabled",
                )}
              />
            }
          />
        )}
        {isTeam && (
          <PermissionRow
            icon={Users}
            title={t(
              "admin.members.internalTeamChatTitle",
              "Internal team chat",
            )}
            description={t(
              "admin.members.internalTeamChatDesc",
              "Allow direct chats with other team members.",
            )}
            control={
              <ProfileFeatureToggle
                userId={member.requester_id}
                column="internal_team_chat_enabled"
                label={t(
                  "admin.members.internalTeamChatTitle",
                  "Internal team chat",
                )}
                value={flags.internalTeamChat}
                onChanged={(next) => update({ internalTeamChat: next })}
                enableTitle={t(
                  "admin.members.internalTeamChatEnableTitle",
                  "Enable internal team chat?",
                )}
                enableBody={t("admin.members.internalTeamChatEnableBody", {
                  name: member.full_name,
                  defaultValue:
                    "{{name}} will be able to start direct chats with other team members. This does not grant manager or admin permissions.",
                })}
                disableTitle={t(
                  "admin.members.internalTeamChatDisableTitle",
                  "Disable internal team chat?",
                )}
                disableBody={t("admin.members.internalTeamChatDisableBody", {
                  name: member.full_name,
                  defaultValue:
                    "{{name}} will no longer be able to start new team-member chats.",
                })}
                enabledToast={t(
                  "admin.members.internalTeamChatEnabled",
                  "Internal team chat enabled",
                )}
                disabledToast={t(
                  "admin.members.internalTeamChatDisabled",
                  "Internal team chat disabled",
                )}
              />
            }
          />
        )}
        <PermissionRow
          icon={Phone}
          tone="brand"
          title={t("admin.members.voiceCallsTitle", "Voice calls")}
          description={t(
            "admin.members.voiceCallsDesc",
            "Allow voice calls with people they already chat with directly.",
          )}
          control={
            <VoiceCallsToggle
              userId={member.requester_id}
              userName={member.full_name}
              value={flags.voiceCalls}
              onChanged={(next) => update({ voiceCalls: next })}
            />
          }
        />
      </PermissionGroup>

      {/* 2. Office & Operations (team members only) */}
      {isTeam && (
        <PermissionGroup
          title={t("admin.members.groupOperations", "Office & Operations")}
        >
          <PermissionRow
            icon={CalendarClock}
            title={t(
              "admin.members.reassignSwitch",
              "Reassign office appointments",
            )}
            description={t(
              "admin.members.reassignDesc",
              "Can move appointments to other members of their office.",
            )}
            control={
              <ReassignAppointmentsToggle
                userId={member.requester_id}
                userName={member.full_name}
                value={flags.reassignAppointments}
                onChanged={(next) => update({ reassignAppointments: next })}
              />
            }
          />
        </PermissionGroup>
      )}

      {/* 3. Growth & Marketing (agents, partners, ambassadors) */}
      {(isAgent || isRecruit) && (
        <PermissionGroup
          title={t("admin.members.groupMarketing", "Growth & Marketing")}
        >
          <PermissionRow
            icon={Link2}
            title={t("admin.features.referralLink", "Referral link")}
            description={t(
              "admin.features.referralLinkHint",
              "Shows a shareable referral link on the member’s dashboard.",
            )}
            control={
              <ReferralLinkToggle
                userId={member.requester_id}
                userName={member.full_name}
                value={flags.referralLink}
                onChanged={(next) => update({ referralLink: next })}
              />
            }
          />
          <PermissionRow
            icon={FileText}
            title={t("admin.features.applyForm", "Built-in apply form")}
            description={t(
              "admin.features.applyFormHint",
              "Adds the Apply page to the member’s dashboard.",
            )}
            control={
              <ApplyFormToggle
                userId={member.requester_id}
                userName={member.full_name}
                value={flags.applyForm}
                onChanged={(next) => update({ applyForm: next })}
              />
            }
          />
        </PermissionGroup>
      )}

      {/* 4. Agent Network & Recruiting (agents + their recruits) */}
      {(isAgent || isRecruit) && (
        <PermissionGroup
          title={t("admin.members.groupNetwork", "Agent Network & Recruiting")}
        >
          {isAgent && (
            <PermissionRow
              icon={Send}
              title={t("admin.agents.inviteRowTitle", "Direct invites")}
              description={t(
                "admin.agents.inviteRowDesc",
                "Send partner/ambassador invites from the agent dashboard",
              )}
              control={
                <AgentInviteToggle
                  agentId={member.requester_id}
                  agentName={member.full_name}
                  canInvite={flags.agentInvite}
                  onChanged={(next) => update({ agentInvite: next })}
                />
              }
            />
          )}
          {isAgent && (
            <PermissionRow
              icon={KeyRound}
              title={t(
                "admin.agents.createRowTitle",
                "Manual account creation",
              )}
              description={t(
                "admin.agents.createRowDesc",
                "Create partner/ambassador accounts with a temp password",
              )}
              control={
                <AgentCreateAccountsToggle
                  agentId={member.requester_id}
                  agentName={member.full_name}
                  canCreateAccounts={flags.agentCreateAccounts}
                  onChanged={(next) => update({ agentCreateAccounts: next })}
                />
              }
            />
          )}
          {isRecruit && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t("agent.parentSection", "Agent (recruiter)")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(
                    "agent.parentHint",
                    "Assigning an agent only routes a flat override from the partner pool on paid cases. Nothing else changes.",
                  )}
                </p>
              </div>
              <AgentParentToggle
                recruitId={member.requester_id}
                recruitName={member.full_name}
                currentAgentId={flags.agentId}
                onChanged={(next) => {
                  update({ agentId: next });
                  onChanged?.();
                }}
              />
            </div>
          )}
        </PermissionGroup>
      )}

      {/* 5. Account Status & Lifecycle */}
      <PermissionGroup
        title={t("admin.members.groupLifecycle", "Account Status & Lifecycle")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t("admin.members.lifecycleStatusLabel", "Account status")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(
                  "admin.members.lifecycleDeactivateHint",
                  "Deactivating blocks sign-in and removes the role. Cases and financial history are kept.",
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={member.is_deactivated ? "destructive" : "outline"}>
              {member.is_deactivated
                ? t("admin.members.statusDeactivated", "Deactivated")
                : t("admin.members.statusActive", "Active")}
            </Badge>
            {!member.is_deactivated && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onDeactivate}
              >
                <Trash2 className="h-4 w-4" />
                {t("admin.members.deactivate", "Deactivate")}
              </Button>
            )}
          </div>
        </div>
      </PermissionGroup>
    </div>
  );
};

export default AccountPermissionsTab;
