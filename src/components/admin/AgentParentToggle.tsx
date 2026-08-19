import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface Props {
  /** The partner/ambassador being assigned to an agent. */
  recruitId: string;
  recruitName: string;
  /** Current agent_id, if any. */
  currentAgentId: string | null;
  /** Called after persisting with the new agent_id (or null on detach). */
  onChanged: (nextAgentId: string | null) => void;
}

/**
 * Assigns / detaches a partner or ambassador from an Agent's network by writing
 * profiles.agent_id (admin-only via restrict_profiles_write). Mirrors the
 * master-partner "attach to network" flow. It only moves the parent link — it
 * never touches earnings, referral code, or payout history, and detaching
 * never deletes the agent_relationships audit trail.
 */
const AgentParentToggle: React.FC<Props> = ({
  recruitId, recruitName, currentAgentId, onChanged,
}) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent');
      if (roleError) return;
      const ids = ((roleRows as { user_id: string }[] | null) ?? [])
        .map((r) => r.user_id)
        .filter(Boolean);
      if (ids.length === 0) {
        setAgents([]);
        return;
      }
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      if (profileError) return;
      setAgents(((profileRows as { id: string; full_name: string | null }[] | null) ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name ?? p.id,
      })));
    };
    load();
  }, []);

  const apply = async () => {
    if (pending === undefined || saving) return;
    const next = pending;
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ agent_id: next })
      .eq('id', recruitId)
      .select('agent_id')
      .maybeSingle();
    setSaving(false);
    setPending(undefined);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed', 'Action failed'), description: error.message });
      onChanged(currentAgentId);
      return;
    }
    const persisted = data ? (data.agent_id ?? null) : next;
    toast({ title: persisted ? t('agent.attached', 'Assigned to agent') : t('agent.detached', 'Removed from agent') });
    onChanged(persisted);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const currentAgent = agents.find((a) => a.id === currentAgentId);

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      {currentAgent ? (
        <span className="text-xs text-muted-foreground">
          {t('agent.parent', 'Agent')}: <span className="font-medium text-foreground">{currentAgent.full_name}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{t('agent.noParent', 'No agent')}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={(e) => { e.stopPropagation(); setPending(currentAgentId); }}
        disabled={saving}
      >
        {currentAgent ? t('agent.reassign', 'Reassign') : t('agent.assign', 'Assign agent')}
      </Button>

      <AlertDialog open={pending !== undefined} onOpenChange={(v) => { if (!v) setPending(undefined); }}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agent.assignTitle', { name: recruitName, defaultValue: 'Assign agent for {{name}}' })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{t('agent.assignBody', 'Choose the Agent who recruited this partner/ambassador. The agent earns a flat commission carved from the partner pool on paid cases — nothing else changes.')}</p>
              <Select
                value={pending ?? currentAgentId ?? 'none'}
                onValueChange={(v) => setPending(v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('agent.detach', 'No agent')}</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={apply} disabled={saving}>{t('common.confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgentParentToggle;
