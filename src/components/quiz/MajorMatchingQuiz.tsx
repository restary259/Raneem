
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResult {
  major: string;
  description: string;
  careers: string[];
  universities: string[];
}

const questions: Question[] = [
  {
    id: 1,
    question: "ما هو المجال الذي يثير اهتمامك أكثر؟",
    options: ["التكنولوجيا والبرمجة", "الطب والرعاية الصحية", "الأعمال والاقتصاد", "الهندسة والتصميم"],
    correctAnswer: 0,
    explanation: "اختيارك يساعد في تحديد ميولك الأكاديمية والمهنية"
  },
  {
    id: 2,
    question: "كيف تفضل قضاء وقت فراغك؟",
    options: ["حل المشاكل التقنية", "مساعدة الآخرين", "تحليل الأسواق", "بناء وتصميم الأشياء"],
    correctAnswer: 0,
    explanation: "الأنشطة التي تستمتع بها تعكس شغفك الحقيقي"
  },
  {
    id: 3,
    question: "ما هي نقطة قوتك الأساسية؟",
    options: ["التفكير المنطقي", "التواصل مع الناس", "إدارة المشاريع", "الإبداع والابتكار"],
    correctAnswer: 0,
    explanation: "معرفة نقاط قوتك تساعد في اختيار التخصص المناسب"
  },
  {
    id: 4,
    question: "أي بيئة عمل تفضل؟",
    options: ["المكتب التقني", "المستشفى أو العيادة", "الشركات الكبرى", "الورش والمختبرات"],
    correctAnswer: 0,
    explanation: "بيئة العمل المفضلة تحدد نوع المهنة المستقبلية"
  },
  {
    id: 5,
    question: "ما هو هدفك المهني الرئيسي؟",
    options: ["تطوير التكنولوجيا", "إنقاذ الأرواح", "بناء الإمبراطوريات التجارية", "تصميم المستقبل"],
    correctAnswer: 0,
    explanation: "أهدافك المهنية تعكس قيمك وطموحاتك"
  }
];

const quizResults: Record<string, QuizResult> = {
  technology: {
    major: "علوم الحاسوب وتكنولوجيا المعلومات",
    description: "مجال متطور يشمل البرمجة، الذكاء الاصطناعي، وأمن المعلومات",
    careers: ["مطور برمجيات", "مهندس ذكاء اصطناعي", "محلل أنظمة", "خبير أمن سيبراني"],
    universities: ["جامعة برلين التقنية", "جامعة ميونخ التقنية", "معهد كارلسروه للتكنولوجيا"]
  },
  medicine: {
    major: "الطب والعلوم الصحية",
    description: "مجال إنساني يركز على صحة الإنسان والرعاية الطبية",
    careers: ["طبيب عام", "طبيب متخصص", "باحث طبي", "صيدلاني"],
    universities: ["جامعة كارول دافيلا للطب", "الجامعة الطبية في رومانيا", "كلية الطب في الأردن"]
  },
  business: {
    major: "إدارة الأعمال والاقتصاد",
    description: "مجال يركز على إدارة المؤسسات والتحليل الاقتصادي",
    careers: ["مدير تنفيذي", "محلل مالي", "مستشار أعمال", "رائد أعمال"],
    universities: ["جامعة بوخارست", "الجامعة الألمانية للأعمال", "الجامعة الأردنية"]
  },
  engineering: {
    major: "الهندسة والتصميم",
    description: "مجال يجمع بين العلوم التطبيقية والإبداع في التصميم",
    careers: ["مهندس مدني", "مهندس ميكانيكي", "مهندس معماري", "مصمم صناعي"],
    universities: ["جامعة آخن التقنية", "جامعة درسدن التقنية", "جامعة شتوتغارت"]
  }
};

const MajorMatchingQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = (userAnswers: number[]) => {
    // Simple scoring logic - count technology-oriented answers
    const techScore = userAnswers.filter(answer => answer === 0).length;
    const medicalScore = userAnswers.filter(answer => answer === 1).length;
    const businessScore = userAnswers.filter(answer => answer === 2).length;
    const engineeringScore = userAnswers.filter(answer => answer === 3).length;

    const scores = {
      technology: techScore,
      medicine: medicalScore,
      business: businessScore,
      engineering: engineeringScore
    };

    const maxScore = Math.max(...Object.values(scores));
    setScore(maxScore);
    setShowResult(true);
  };

  const getRecommendedMajor = (): QuizResult => {
    const techScore = answers.filter(answer => answer === 0).length;
    const medicalScore = answers.filter(answer => answer === 1).length;
    const businessScore = answers.filter(answer => answer === 2).length;
    const engineeringScore = answers.filter(answer => answer === 3).length;

    if (techScore >= medicalScore && techScore >= businessScore && techScore >= engineeringScore) {
      return quizResults.technology;
    } else if (medicalScore >= businessScore && medicalScore >= engineeringScore) {
      return quizResults.medicine;
    } else if (businessScore >= engineeringScore) {
      return quizResults.business;
    } else {
      return quizResults.engineering;
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResult(false);
    setScore(0);
  };

  if (showResult) {
    const recommendedMajor = getRecommendedMajor();
    
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-16 w-16 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-primary">
            نتيجة اختبار مطابقة التخصص
          </CardTitle>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              النتيجة: {score}/{questions.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6">
            <h3 className="text-xl font-bold text-primary mb-3">
              التخصص المقترح لك:
            </h3>
            <h4 className="text-lg font-semibold mb-2">{recommendedMajor.major}</h4>
            <p className="text-gray-600 mb-4">{recommendedMajor.description}</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold text-primary mb-2">المهن المتاحة:</h5>
                <ul className="space-y-1">
                  {recommendedMajor.careers.map((career, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{career}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="font-semibold text-primary mb-2">الجامعات المقترحة:</h5>
                <ul className="space-y-1">
                  {recommendedMajor.universities.map((university, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{university}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={resetQuiz} variant="outline" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              إعادة الاختبار
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              احجز استشارة مجانية
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl sm:text-2xl text-primary">
            اختبار مطابقة التخصص
          </CardTitle>
          <Badge variant="secondary">
            {currentQuestion + 1} / {questions.length}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-6">{currentQ.question}</h3>
          
          <div className="grid gap-3">
            {currentQ.options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className="p-4 h-auto text-right justify-start hover:bg-primary hover:text-white transition-all duration-200"
                onClick={() => handleAnswer(index)}
              >
                <span className="w-full text-right">{option}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MajorMatchingQuiz;
