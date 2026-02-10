
import React from 'react';
import AIQuizChat from '@/components/quiz/AIQuizChat';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';

const QuizPage = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEOHead title={t('seo.quizTitle')} description={t('seo.quizDesc')} />
      <AIQuizChat />
    </>
  );
};

export default QuizPage;
