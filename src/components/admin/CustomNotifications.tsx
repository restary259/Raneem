import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Send } from 'lucide-react';

const ROLE_OPTIONS = [
  { id: 'lawyer', label: 'المحامون' },
  { id: 'user', label: 'الطلاب' },
  { id: 'influencer', label: 'الوكلاء' },
];

const CustomNotifications: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const selectAll = () => {
    if (selectedRoles.length === ROLE_OPTIONS.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(ROLE_OPTIONS.map(r => r.id));
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || selectedRoles.length === 0) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى ملء جميع الحقول واختيار فئة واحدة على الأقل' });
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مسجل الدخول');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-custom-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), roles: selectedRoles }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'فشل الإرسال');

      toast({ title: 'تم الإرسال', description: `تم إرسال الإشعار إلى ${result.sent || 0} مشترك` });
      setTitle('');
      setBody('');
      setSelectedRoles([]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            إرسال إشعار مخصص
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>عنوان الإشعار</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: تحديث مهم" maxLength={100} />
          </div>
          <div>
            <Label>نص الإشعار</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب رسالة الإشعار هنا..." rows={4} maxLength={500} />
          </div>
          <div>
            <Label className="mb-2 block">إرسال إلى</Label>
            <div className="flex flex-wrap gap-4">
              {ROLE_OPTIONS.map(role => (
                <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedRoles.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                  <span className="text-sm">{role.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectedRoles.length === ROLE_OPTIONS.length} onCheckedChange={selectAll} />
                <span className="text-sm font-medium">الكل</span>
              </label>
            </div>
          </div>
          <Button onClick={handleSend} disabled={sending || !title.trim() || !body.trim() || selectedRoles.length === 0} className="w-full sm:w-auto">
            <Send className="h-4 w-4 me-2" />
            {sending ? 'جاري الإرسال...' : 'إرسال الآن'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomNotifications;
