import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator } from "lucide-react";

type Subject = {
  id: string;
  name: string;
  units: string;
  grade: string;
};

const initialSubjects: Subject[] = [
    { id: 'arabic', name: 'العربية', units: '', grade: '' },
    { id: 'hebrew', name: 'العبرية', units: '', grade: '' },
    { id: 'english', name: 'الإنجليزية', units: '', grade: '' },
    { id: 'math', name: 'الرياضيات', units: '', grade: '' },
    { id: 'history', name: 'التاريخ', units: '', grade: '' },
    { id: 'deen', name: 'التربية الدينية', units: '', grade: '' },
    { id: 'mdniat', name: 'التربية الوطنية', units: '', grade: '' },
    { id: 't5sos1', name: 'تخصص 1', units: '', grade: '' },
    { id: 't5sos2', name: 'تخصص 2', units: '', grade: '' },
    { id: 't5sos3', name: 'تخصص 3', units: '', grade: '' },
];

const GpaCalculator = () => {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [results, setResults] = useState<{ average: number | null; germanGrade: number | null }>({ average: null, germanGrade: null });
  const [error, setError] = useState<string | null>(null);

  const handleSubjectChange = (index: number, field: 'units' | 'grade', value: string) => {
    const newSubjects = [...subjects];
    if (field === 'grade') {
        if (value) {
            const numericValue = parseInt(value, 10);
            if (numericValue < 0) value = '0';
            if (numericValue > 100) value = '100';
        }
    }
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const handleCalculate = () => {
    setError(null);
    const validSubjects = subjects.filter(s => s.units && s.grade);
    
    if (validSubjects.length === 0) {
        setError("الرجاء إدخال مادة واحدة على الأقل مع وحداتها وعلامتها.");
        setResults({ average: null, germanGrade: null });
        return;
    }

    const totalWeightedGrade = validSubjects.reduce((acc, s) => acc + (parseInt(s.units, 10) * parseInt(s.grade, 10)), 0);
    const totalUnits = validSubjects.reduce((acc, s) => acc + parseInt(s.units, 10), 0);

    if (totalUnits === 0) {
        setError("مجموع الوحدات لا يمكن أن يكون صفرًا.");
        setResults({ average: null, germanGrade: null });
        return;
    }

    const average = totalWeightedGrade / totalUnits;
    const germanGrade = 1 + 3 * ((100 - average) / 30);
    
    setResults({
        average: parseFloat(average.toFixed(2)),
        germanGrade: parseFloat(Math.max(1.0, Math.min(5.0, germanGrade)).toFixed(2))
    });
  };
  
  const handleReset = () => {
    setSubjects(JSON.parse(JSON.stringify(initialSubjects)));
    setResults({ average: null, germanGrade: null });
    setError(null);
  };

  return (
    <Card className="w-full border-none shadow-none" dir="rtl">
        <CardHeader className="text-center px-0">
            <CardTitle className="text-3xl font-bold text-primary">حاسبة المعدل بالنظام الألماني</CardTitle>
            <CardDescription>أدخل علاماتك وعدد الوحدات لكل مادة لحساب معدلك والمكافئ له في النظام الألماني.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {subjects.map((subject, index) => (
                    <div key={subject.id} className="space-y-2">
                        <Label htmlFor={subject.id}>{subject.name}</Label>
                        <div className="flex gap-2">
                            <Select
                                value={subject.units}
                                onValueChange={(value) => handleSubjectChange(index, 'units', value)}
                            >
                                <SelectTrigger aria-label={`${subject.name} units`}>
                                    <SelectValue placeholder="الوحدات" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...Array(6).keys()].map(i => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                id={subject.id}
                                type="number"
                                placeholder="العلامة (0-100)"
                                min="0"
                                max="100"
                                value={subject.grade}
                                onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {error && (
                <Alert variant="destructive">
                   <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {results.average !== null && results.germanGrade !== null && (
                 <Alert variant="default" className="bg-primary/10 border-primary/50">
                    <Calculator className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-bold text-primary">النتائج</AlertTitle>
                    <AlertDescription className="text-right space-y-1 text-foreground">
                        <p>معدلك العام هو: <span className="font-bold">{results.average}</span></p>
                        <p>معدلك حسب النظام الألماني هو: <span className="font-bold">{results.germanGrade}</span></p>
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pt-6 px-0">
            <Button onClick={handleCalculate} className="w-full sm:w-auto flex-grow sm:flex-grow-0">احسب المعدل</Button>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto flex-grow sm:flex-grow-0">إعادة تعيين</Button>
        </CardFooter>
    </Card>
  );
};

export default GpaCalculator;
