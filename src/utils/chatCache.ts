
// localStorage helpers for AI conversation persistence

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_HISTORY_KEY = 'darb-ai-chat-history';
const MAX_CONVERSATIONS = 50; // max messages to store

export const saveChatHistory = (messages: ChatMessage[]): void => {
  try {
    const trimmed = messages.slice(-MAX_CONVERSATIONS);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[ChatCache] Failed to save:', e);
  }
};

export const loadChatHistory = (): ChatMessage[] => {
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const clearChatHistory = (): void => {
  localStorage.removeItem(CHAT_HISTORY_KEY);
};

// Offline FAQ answers (pre-cached for offline use)
export const OFFLINE_FAQ: Record<string, string> = {
  'كيف أبدأ التقديم للجامعات الألمانية؟':
    'للتقديم للجامعات الألمانية:\n1. اختر التخصص والجامعة عبر uni-assist.de\n2. جهّز الأوراق: شهادة الثانوية، كشف العلامات، شهادة لغة\n3. قدّم عبر uni-assist أو مباشرة للجامعة\n4. انتظر القبول ثم قدّم على التأشيرة\n\nتواصل مع فريق درب للمساعدة في كل خطوة!',
  'ما هي متطلبات التأشيرة الدراسية؟':
    'متطلبات التأشيرة الدراسية لألمانيا:\n• خطاب قبول جامعي\n• إثبات مالي (حساب مغلق ~11,208 يورو/سنة)\n• تأمين صحي\n• جواز سفر ساري\n• صور شخصية\n• شهادة لغة (ألمانية أو إنجليزية)\n\nالموعد في السفارة الألمانية مطلوب.',
  'ما مستوى اللغة الألمانية المطلوب؟':
    'مستوى اللغة المطلوب:\n• للبرامج الألمانية: B2-C1 (TestDaF أو DSH)\n• للبرامج الإنجليزية: IELTS 6.0-6.5 أو TOEFL 80+\n• للسنة التحضيرية: B1\n• لمعاهد اللغة: لا يُشترط مستوى مسبق\n\nدرب تساعدك في اختيار دورة اللغة المناسبة!',
  'كم تكلفة المعيشة في ألمانيا؟':
    'تكلفة المعيشة الشهرية في ألمانيا:\n• السكن: 300-600 يورو\n• الطعام: 200-300 يورو\n• التأمين الصحي: ~110 يورو\n• المواصلات: 30-50 يورو (تذكرة الطلاب)\n• مصاريف شخصية: 100-200 يورو\n\nالمجموع: ~750-1,250 يورو/شهر حسب المدينة.',
};
