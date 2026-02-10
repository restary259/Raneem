
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, saveChatHistory, loadChatHistory, clearChatHistory, OFFLINE_FAQ } from '@/utils/chatCache';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export const QUICK_QUESTIONS = [
  'كيف أبدأ التقديم للجامعات الألمانية؟',
  'ما هي متطلبات التأشيرة الدراسية؟',
  'ما مستوى اللغة الألمانية المطلوب؟',
  'كم تكلفة المعيشة في ألمانيا؟',
];

export const useAIChat = (persistHistory = false) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted history
  useEffect(() => {
    if (persistHistory) {
      const saved = loadChatHistory();
      if (saved.length > 0) setMessages(saved);
    }
  }, [persistHistory]);

  // Save on change
  useEffect(() => {
    if (persistHistory && messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages, persistHistory]);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    // Offline fallback
    if (!isOnline) {
      const faqAnswer = OFFLINE_FAQ[text.trim()];
      const offlineReply = faqAnswer || 'أنت غير متصل بالإنترنت حالياً. يمكنك مراجعة المحادثات السابقة أو تجربة الأسئلة الشائعة.';
      setMessages(prev => [...prev, { role: 'assistant', content: offlineReply }]);
      setIsLoading(false);
      return;
    }

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل الاتصال بالمساعد الذكي');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      console.error('AI Chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: `عذراً، حدث خطأ: ${e.message}` }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, isLoading, isOnline]);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    clearChatHistory();
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    isOnline,
    inputRef,
    messagesEndRef,
    sendMessage,
    clearHistory: handleClearHistory,
  };
};
