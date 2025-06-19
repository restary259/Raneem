
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RotateCcw, Trophy, ArrowRight, Home, GraduationCap, Users, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  averageSalary: string;
  jobOutlook: string;
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
  },
  {
    id: 6,
    question: "ما المهارة التي تتميز بها أكثر؟",
    options: ["البرمجة والتحليل", "العناية والاهتمام", "التفاوض والإقناع", "التصميم والإبداع"],
    correctAnswer: 0,
    explanation: "مهاراتك الطبيعية توجهك نحو المجال المناسب"
  },
  {
    id: 7,
    question: "ما نوع المشاريع التي تحب العمل عليها؟",
    options: ["تطبيقات ومواقع", "أبحاث طبية", "خطط استثمارية", "مشاريع معمارية"],
    correctAnswer: 0,
    explanation: "نوع المشاريع يعكس اهتماماتك المهنية"
  },
  {
    id: 8,
    question: "كيف تتعامل مع التحديات؟",
    options: ["بالتحليل والكود", "بالصبر والعناية", "بالاستراتيجية", "بالإبداع والابتكار"],
    correctAnswer: 0,
    explanation: "أسلوبك في حل المشاكل يحدد مجال عملك المناسب"
  }
];

const quizResults: Record<string, QuizResult> = {
  technology: {
    major: "علوم الحاسوب وتكنولوجيا المعلومات",
    description: "مجال متطور يشمل البرمجة، الذكاء الاصطناعي، وأمن المعلومات",
    careers: ["مطور برمجيات", "مهندس ذكاء اصطناعي", "محلل أنظمة", "خبير أمن سيبراني", "مصمم UX/UI"],
    universities: ["TU Munich", "RWTH Aachen", "TU Berlin", "Karlsruhe Institute of Technology"],
    averageSalary: "4,500-8,000€ شهرياً",
    jobOutlook: "نمو مرتفع - 15% سنوياً"
  },
  medicine: {
    major: "الطب والعلوم الصحية",
    description: "مجال إنساني يركز على صحة الإنسان والرعاية الطبية",
    careers: ["طبيب عام", "طبيب متخصص", "باحث طبي", "صيدلاني", "ممرض متخصص"],
    universities: ["Carol Davila University", "University of Medicine Romania", "Medical University Jordan"],
    averageSalary: "3,500-12,000€ شهرياً",
    jobOutlook: "نمو مستقر - 7% سنوياً"
  },
  business: {
    major: "إدارة الأعمال والاقتصاد",
    description: "مجال يركز على إدارة المؤسسات والتحليل الاقتصادي",
    careers: ["مدير تنفيذي", "محلل مالي", "مستشار أعمال", "رائد أعمال", "محلل استثمارات"],
    universities: ["University of Bucharest", "German Business School", "Yarmouk University"],
    averageSalary: "3,000-10,000€ شهرياً",
    jobOutlook: "نمو متوسط - 8% سنوياً"
  },
  engineering: {
    major: "الهندسة والتصميم",
    description: "مجال يجمع بين العلوم التطبيقية والإبداع في التصميم",
    careers: ["مهندس مدني", "مهندس ميكانيكي", "م. معماري", "مصمم صناعي", "مهندس بيئي"],
    universities: ["TU Dresden", "TU Darmstadt", "University of Stuttgart", "TU Braunschweig"],
    averageSalary: "3,800-7,500€ شهرياً",
    jobOutlook: "نمو جيد - 10% سنوياً"
  }
};

const MajorMatchingQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const navigate = useNavigate();

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
    const techScore = userAnswers.filter(answer => answer === 0).length;
    const medicalScore = userAnswers.filter(answer => answer === 1).length;
    const businessScore = userAnswers.filter(answer => answer === 2).length;
    const engineeringScore = userAnswers.filter(answer => answer === 3).length;

    const maxScore = Math.max(techScore, medicalScore, businessScore, engineeringScore);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="w-full">
            <CardHeader className="text-center bg-gradient-to-r from-primary to-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-center mb-4">
                <Trophy className="h-16 w-16 text-yellow-300" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl">
                🎉 تهانينا! اكتشفنا تخصصك المثالي
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Badge variant="secondary" className="text-lg px-4 py-2 bg-white text-primary">
                  دقة النتيجة: {Math.round((score / questions.length) * 100)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-primary mb-3 flex items-center gap-2">
                  <GraduationCap className="h-6 w-6" />
                  التخصص المقترح لك:
                </h3>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">{recommendedMajor.major}</h4>
                <p className="text-gray-600 mb-6 text-lg">{recommendedMajor.description}</p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-primary mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        المهن المتاحة:
                      </h5>
                      <ul className="space-y-2">
                        {recommendedMajor.careers.map((career, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm">{career}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-green-700 mb-1">💰 متوسط الراتب:</h5>
                      <p className="text-green-600 font-medium">{recommendedMajor.averageSalary}</p>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-700 mb-1">📈 توقعات سوق العمل:</h5>
                      <p className="text-blue-600 font-medium">{recommendedMajor.jobOutlook}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-primary mb-3 flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      الجامعات المقترحة:
                    </h5>
                    <ul className="space-y-2">
                      {recommendedMajor.universities.map((university, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm">{university}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button onClick={resetQuiz} variant="outline" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  إعادة الاختبار
                </Button>
                <Button 
                  onClick={() => navigate('/contact')}
                  className="bg-primary hover:bg-primary/90 flex items-center gap-2"
                >
                  احجز استشارة مجانية
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => navigate('/partners')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  تصفح الجامعات
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Home Button */}
        <div className="flex justify-between items-center mb-8">
          <Button 
            onClick={() => navigate('/')}
            variant="outline" 
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            الرئيسية
          </Button>
          <h1 className="text-2xl font-bold text-center text-primary">
            اكتشف تخصصك المثالي
          </h1>
          <div></div> {/* Spacer for centering */}
        </div>

        <Card className="w-full">
          <CardHeader className="bg-gradient-to-r from-primary to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-xl sm:text-2xl">
                اختبار مطابقة التخصص
              </CardTitle>
              <Badge variant="secondary" className="bg-white text-primary">
                {currentQuestion + 1} / {questions.length}
              </Badge>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center text-white/90 text-sm mt-2">
              {Math.round(progress)}% مكتمل
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 p-8">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-6 text-gray-800 leading-relaxed">
                {currentQ.question}
              </h3>
              
              <div className="grid gap-3 max-w-2xl mx-auto">
                {currentQ.options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="p-4 h-auto text-right justify-start hover:bg-primary hover:text-white transition-all duration-200 border-2 hover:border-primary hover:scale-105"
                    onClick={() => handleAnswer(index)}
                  >
                    <span className="w-full text-right">{option}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MajorMatchingQuiz;
