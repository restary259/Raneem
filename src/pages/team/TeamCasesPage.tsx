import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Loader2, AlertTriangle, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type TabId = 'mine' | 'unassigned' | 'all' | 'forgotten';
type StatusFilter = 'all' | 'new' | 'contacted' | 'appointment_scheduled' | 'profile_completion' | 'payment_confirmed' | 'submitted';

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  appointment_scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
  profile_completion: 'bg-orange-100 text-orange-800 border-orange-200',
  payment_confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  submitted: 'bg-teal-100 text-teal-800 border-teal-200',
  enrollment_paid: 'bg-green-100 text-green-800 border-green-200',
  forgotten: 'bg-red-100 text-red-800 border-red-200',
};

export default function TeamCasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<TabId>('mine');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase.from('cases').select('*').order('last_activity_at', { ascending: false });

      if (tab === 'mine') query = query.eq('assigned_to', user.id);
      else if (tab === 'unassigned') query = query.is('assigned_to', null);
      else if (tab === 'forgotten') {
        const { data } = await supabase.rpc('get_forgotten_cases' as any);
        setCases((data as Case[]) ?? []);
        setLoading(false);
        return;
      }

      const { data } = await query;
      setCases((data as Case[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search);
    return matchStatus && matchSearch;
  });

  const handleCreateCase = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast({ variant: 'destructive', description: 'Name and phone are required' });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.from('cases').insert({
        full_name: newName.trim(),
        phone_number: newPhone.trim(),
        source: 'manual',
        assigned_to: user!.id,
        status: 'new',
      }).select().single();
      if (error) throw error;
      toast({ title: 'Case created' });
      setShowNew(false);
      setNewName(''); setNewPhone('');
      navigate(`/team/cases/${(data as Case).id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const STATUS_FILTERS: StatusFilter[] = ['all', 'new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted'];

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 me-2" /> New Case
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="mine">My Cases</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="forgotten" className="text-destructive">
            <AlertTriangle className="h-3 w-3 me-1" /> Forgotten
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name or phone..." className="ps-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)} className="text-xs h-9 capitalize">
              {s.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No cases found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/team/cases/${c.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <Phone className="h-3 w-3" />{c.phone_number}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[c.status] ?? 'bg-muted text-foreground'}>
                  {c.status.replace(/_/g, ' ')}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Case</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Student name" /></div>
            <div><Label>Phone *</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+972..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreateCase} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
