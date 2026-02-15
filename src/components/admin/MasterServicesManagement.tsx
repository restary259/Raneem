import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Package, DollarSign, Users, Percent } from 'lucide-react';

interface MasterService {
  id: string;
  service_name: string;
  internal_cost: number;
  sale_price: number;
  currency: string;
  commission_eligible: boolean;
  team_commission_type: string;
  team_commission_value: number;
  influencer_commission_type: string;
  influencer_commission_value: number;
  refundable: boolean;
  requires_document_upload: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const EMPTY_SERVICE = {
  service_name: '',
  internal_cost: 0,
  sale_price: 0,
  currency: 'ILS',
  commission_eligible: false,
  team_commission_type: 'fixed',
  team_commission_value: 0,
  influencer_commission_type: 'none',
  influencer_commission_value: 0,
  refundable: false,
  requires_document_upload: false,
  is_active: true,
  sort_order: 0,
};

const MasterServicesManagement: React.FC = () => {
  const [services, setServices] = useState<MasterService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('master_services')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setServices(data);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_SERVICE, sort_order: services.length });
    setShowModal(true);
  };

  const openEdit = (s: MasterService) => {
    setEditingId(s.id);
    setForm({
      service_name: s.service_name,
      internal_cost: s.internal_cost,
      sale_price: s.sale_price,
      currency: s.currency,
      commission_eligible: s.commission_eligible,
      team_commission_type: s.team_commission_type,
      team_commission_value: s.team_commission_value,
      influencer_commission_type: s.influencer_commission_type,
      influencer_commission_value: s.influencer_commission_value,
      refundable: s.refundable,
      requires_document_upload: s.requires_document_upload,
      is_active: s.is_active,
      sort_order: s.sort_order,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.service_name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Service name is required' });
      return;
    }
    setSaving(true);

    const payload = {
      service_name: form.service_name.trim(),
      internal_cost: Number(form.internal_cost) || 0,
      sale_price: Number(form.sale_price) || 0,
      currency: form.currency,
      commission_eligible: form.commission_eligible,
      team_commission_type: form.team_commission_type,
      team_commission_value: Number(form.team_commission_value) || 0,
      influencer_commission_type: form.influencer_commission_type,
      influencer_commission_value: form.influencer_commission_type === 'none' ? 0 : Number(form.influencer_commission_value) || 0,
      refundable: form.refundable,
      requires_document_upload: form.requires_document_upload,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    };

    let error;
    if (editingId) {
      ({ error } = await (supabase as any).from('master_services').update(payload).eq('id', editingId));
    } else {
      ({ error } = await (supabase as any).from('master_services').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: editingId ? 'Service updated' : 'Service created' });
    setShowModal(false);
    fetchServices();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Soft delete — deactivate instead of removing
    const { error } = await (supabase as any).from('master_services').update({ is_active: false }).eq('id', deleteId);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else toast({ title: 'Service deactivated' });
    setDeleteId(null);
    fetchServices();
  };

  const commLabel = (type: string, value: number, currency: string) => {
    if (type === 'none') return '—';
    if (type === 'percentage') return `${value}%`;
    return `${value} ${currency}`;
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{services.length} services configured</p>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 me-1" />Add Service</Button>
      </div>

      <div className="grid gap-3">
        {services.map(s => (
          <Card key={s.id} className={`shadow-sm ${!s.is_active ? 'opacity-50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">{s.service_name}</h3>
                    {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    {s.refundable && <Badge variant="outline" className="text-[10px]">Refundable</Badge>}
                    {s.requires_document_upload && <Badge variant="outline" className="text-[10px]">Docs Required</Badge>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1 p-1.5 bg-emerald-50 rounded">
                      <DollarSign className="h-3 w-3 text-emerald-600" />
                      <span>Sale: {s.sale_price} {s.currency}</span>
                    </div>
                    <div className="flex items-center gap-1 p-1.5 bg-muted rounded">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span>Cost: {s.internal_cost} {s.currency}</span>
                    </div>
                    <div className="flex items-center gap-1 p-1.5 bg-blue-50 rounded">
                      <Users className="h-3 w-3 text-blue-600" />
                      <span>Team: {commLabel(s.team_commission_type, s.team_commission_value, s.currency)}</span>
                    </div>
                    <div className="flex items-center gap-1 p-1.5 bg-purple-50 rounded">
                      <Percent className="h-3 w-3 text-purple-600" />
                      <span>Agent: {commLabel(s.influencer_commission_type, s.influencer_commission_value, s.currency)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(s)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && <p className="text-center text-muted-foreground py-8">No services configured yet. Add your first service above.</p>}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Service Name *</Label>
              <Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} />
            </div>
            <div>
              <Label>Sale Price</Label>
              <Input type="number" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Internal Cost</Label>
              <Input type="number" value={form.internal_cost} onChange={e => setForm(f => ({ ...f, internal_cost: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">₪ ILS</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>

            {/* Commission Settings */}
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Commission Settings</p>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.commission_eligible} onCheckedChange={v => setForm(f => ({ ...f, commission_eligible: v }))} />
              <Label>Commission Eligible</Label>
            </div>
            {form.commission_eligible && (
              <>
                <div>
                  <Label>Team Commission Type</Label>
                  <Select value={form.team_commission_type} onValueChange={v => setForm(f => ({ ...f, team_commission_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Team Commission {form.team_commission_type === 'percentage' ? '(%)' : `(${form.currency})`}</Label>
                  <Input type="number" value={form.team_commission_value} onChange={e => setForm(f => ({ ...f, team_commission_value: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Agent Commission Type</Label>
                  <Select value={form.influencer_commission_type} onValueChange={v => setForm(f => ({ ...f, influencer_commission_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.influencer_commission_type !== 'none' && (
                  <div>
                    <Label>Agent Commission {form.influencer_commission_type === 'percentage' ? '(%)' : `(${form.currency})`}</Label>
                    <Input type="number" value={form.influencer_commission_value} onChange={e => setForm(f => ({ ...f, influencer_commission_value: Number(e.target.value) }))} />
                  </div>
                )}
              </>
            )}

            {/* Flags */}
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Options</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.refundable} onCheckedChange={v => setForm(f => ({ ...f, refundable: v }))} />
              <Label>Refundable</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.requires_document_upload} onCheckedChange={v => setForm(f => ({ ...f, requires_document_upload: v }))} />
              <Label>Requires Document Upload</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Service?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the service. Existing case snapshots using it will be preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MasterServicesManagement;
