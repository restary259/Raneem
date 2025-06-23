
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AcademicBackground, TestScore } from '@/types/profile';
import { Plus, Edit, Trash2, GraduationCap, Award, Calendar } from 'lucide-react';

interface AcademicTabProps {
  academicBackgrounds: AcademicBackground[];
  testScores: TestScore[];
  onUpdate: () => void;
  userId: string;
}

const AcademicTab: React.FC<AcademicTabProps> = ({
  academicBackgrounds,
  testScores,
  onUpdate,
  userId
}) => {
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingAcademic, setEditingAcademic] = useState<AcademicBackground | null>(null);
  const [editingTest, setEditingTest] = useState<TestScore | null>(null);
  const { toast } = useToast();

  const handleSaveAcademic = async (data: Partial<AcademicBackground>) => {
    try {
      if (editingAcademic) {
        const { error } = await supabase
          .from('academic_backgrounds')
          .update(data)
          .eq('id', editingAcademic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('academic_backgrounds')
          .insert({ ...data, user_id: userId });
        if (error) throw error;
      }

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم حفظ المعلومات الأكاديمية",
      });

      setShowAcademicModal(false);
      setEditingAcademic(null);
      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحفظ",
        description: error.message,
      });
    }
  };

  const handleSaveTest = async (data: Partial<TestScore>) => {
    try {
      if (editingTest) {
        const { error } = await supabase
          .from('test_scores')
          .update(data)
          .eq('id', editingTest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('test_scores')
          .insert({ ...data, user_id: userId });
        if (error) throw error;
      }

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم حفظ نتيجة الاختبار",
      });

      setShowTestModal(false);
      setEditingTest(null);
      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحفظ",
        description: error.message,
      });
    }
  };

  const handleDeleteAcademic = async (id: string) => {
    try {
      const { error } = await supabase
        .from('academic_backgrounds')
        .delete()
        .eq('id',);

      if (error) throw error;

      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المعلومات الأكاديمية",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: error.message,
      });
    }
  };

  const handleDeleteTest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('test_scores')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف نتيجة الاختبار",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: error.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Academic Backgrounds */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              الخلفية الأكاديمية
            </CardTitle>
            <Dialog open={showAcademicModal} onOpenChange={setShowAcademicModal}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingAcademic(null)}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة مؤهل
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingAcademic ? 'تعديل المؤهل الأكاديمي' : 'إضافة مؤهل أكاديمي'}
                  </DialogTitle>
                </DialogHeader>
                <AcademicForm 
                  academic={editingAcademic}
                  onSave={handleSaveAcademic}
                  onCancel={() => {
                    setShowAcademicModal(false);
                    setEditingAcademic(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {academicBackgrounds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد مؤهلات أكاديمية مضافة بعد
            </div>
          ) : (
            <div className="space-y-4">
              {academicBackgrounds.map((academic) => (
                <div key={academic.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{academic.institution}</h3>
                      {academic.degree && (
                        <p className="text-muted-foreground">{academic.degree}</p>
                      )}
                      {academic.field_of_study && (
                        <p className="text-sm text-muted-foreground">
                          تخصص: {academic.field_of_study}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        {academic.graduation_year && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {academic.graduation_year}
                          </Badge>
                        )}
                        {academic.gpa && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            GPA: {academic.gpa}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAcademic(academic);
                          setShowAcademicModal(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAcademic(academic.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Scores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              نتائج الاختبارات
            </CardTitle>
            <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingTest(null)}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة نتيجة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTest ? 'تعديل نتيجة الاختبار' : 'إضافة نتيجة اختبار'}
                  </DialogTitle>
                </DialogHeader>
                <TestForm 
                  test={editingTest}
                  onSave={handleSaveTest}
                  onCancel={() => {
                    setShowTestModal(false);
                    setEditingTest(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {testScores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد نتائج اختبارات مضافة بعد
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testScores.map((test) => (
                <div key={test.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{test.test_name}</h3>
                      <p className="text-2xl font-bold text-blue-600">{test.score}</p>
                      {test.date_taken && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(test.date_taken).toLocaleDateString('ar-SA')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTest(test);
                          setShowTestModal(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTest(test.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Academic Form Component
const AcademicForm: React.FC<{
  academic: AcademicBackground | null;
  onSave: (data: Partial<AcademicBackground>) => void;
  onCancel: () => void;
}> = ({ academic, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    institution: academic?.institution || '',
    degree: academic?.degree || '',
    field_of_study: academic?.field_of_study || '',
    gpa: academic?.gpa || '',
    graduation_year: academic?.graduation_year || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      gpa: formData.gpa ? parseFloat(formData.gpa.toString()) : undefined,
      graduation_year: formData.graduation_year ? parseInt(formData.graduation_year.toString()) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="institution">المؤسسة التعليمية *</Label>
        <Input
          id="institution"
          value={formData.institution}
          onChange={e => setFormData({ ...formData, institution: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="degree">الدرجة العلمية</Label>
        <Input
          id="degree"
          value={formData.degree}
          onChange={e => setFormData({ ...formData, degree: e.target.value })}
          placeholder="بكالوريوس، ماجستير، دكتوراه..."
        />
      </div>
      <div>
        <Label htmlFor="field_of_study">التخصص</Label>
        <Input
          id="field_of_study"
          value={formData.field_of_study}
          onChange={e => setFormData({ ...formData, field_of_study: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="gpa">المعدل التراكمي</Label>
          <Input
            id="gpa"
            type="number"
            step="0.01"
            max="4.00"
            value={formData.gpa}
            onChange={e => setFormData({ ...formData, gpa: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="graduation_year">سنة التخرج</Label>
          <Input
            id="graduation_year"
            type="number"
            min="1950"
            max={new Date().getFullYear() + 10}
            value={formData.graduation_year}
            onChange={e => setFormData({ ...formData, graduation_year: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit">
          حفظ
        </Button>
      </div>
    </form>
  );
};

// Test Form Component
const TestForm: React.FC<{
  test: TestScore | null;
  onSave: (data: Partial<TestScore>) => void;
  onCancel: () => void;
}> = ({ test, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    test_name: test?.test_name || '',
    score: test?.score || '',
    date_taken: test?.date_taken || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="test_name">اسم الاختبار *</Label>
        <Input
          id="test_name"
          value={formData.test_name}
          onChange={e => setFormData({ ...formData, test_name: e.target.value })}
          placeholder="IELTS, TOEFL, SAT, GRE..."
          required
        />
      </div>
      <div>
        <Label htmlFor="score">النتيجة *</Label>
        <Input
          id="score"
          value={formData.score}
          onChange={e => setFormData({ ...formData, score: e.target.value })}
          placeholder="7.5, 110, 1500..."
          required
        />
      </div>
      <div>
        <Label htmlFor="date_taken">تاريخ الاختبار</Label>
        <Input
          id="date_taken"
          type="date"
          value={formData.date_taken}
          onChange={e => setFormData({ ...formData, date_taken: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit">
          حفظ
        </Button>
      </div>
    </form>
  );
};

export default AcademicTab;
