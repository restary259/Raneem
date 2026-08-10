
// AI conversation persistence — encrypted at rest, session-scoped, expiring.
//
// Chat history may contain personal details, so the payload is AES-GCM
// encrypted (Web Crypto) before it ever touches localStorage. The key is a
// random 256-bit key held ONLY in sessionStorage, so it dies with the tab:
// the ciphertext left on disk is unreadable once the session ends and is not
// co-located with the key. An expiry timestamp bounds how long any readable
// copy can live. If Web Crypto is unavailable (non-secure context / very old
// browser) we degrade to no persistence rather than store plaintext.

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_HISTORY_KEY = 'darb-ai-chat-history-v2';
// v1 stored plaintext JSON — purge it whenever we touch storage so the
// unencrypted copy does not linger on disk.
const LEGACY_CHAT_HISTORY_KEY = 'darb-ai-chat-history';
const CHAT_KEY_SESSION_KEY = 'darb-ai-chat-key';
const MAX_CONVERSATIONS = 50; // max messages to store
const CHAT_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface EncryptedPayload {
  v: 2;
  iv: string; // base64 AES-GCM IV
  data: string; // base64 ciphertext
  savedAt: number; // epoch ms
}

const subtle = () => globalThis.crypto?.subtle;

const toBase64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const fromBase64 = (str: string): Uint8Array =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const purgeLegacy = (): void => {
  try {
    localStorage.removeItem(LEGACY_CHAT_HISTORY_KEY);
  } catch {
    // ignore
  }
};

/** Returns the session AES-GCM key (generated once, kept in sessionStorage). */
const getKey = async (): Promise<CryptoKey | null> => {
  const s = subtle();
  if (!s) return null;
  try {
    const stored = sessionStorage.getItem(CHAT_KEY_SESSION_KEY);
    if (stored) {
      return await s.importKey(
        'raw',
        fromBase64(stored).buffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    const key = await s.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const raw = await s.exportKey('raw', key);
    sessionStorage.setItem(CHAT_KEY_SESSION_KEY, toBase64(raw));
    return key;
  } catch (e) {
    console.warn('[ChatCache] Key setup failed:', e);
    return null;
  }
};

export const saveChatHistory = async (messages: ChatMessage[]): Promise<void> => {
  purgeLegacy();
  const key = await getKey();
  if (!key) return; // crypto unavailable → keep chat in-memory only, never plaintext
  try {
    const trimmed = messages.slice(-MAX_CONVERSATIONS);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const cipher = await subtle().encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(trimmed)),
    );
    const payload: EncryptedPayload = {
      v: 2,
      iv: toBase64(iv),
      data: toBase64(cipher),
      savedAt: Date.now(),
    };
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[ChatCache] Failed to save:', e);
  }
};

export const loadChatHistory = async (): Promise<ChatMessage[]> => {
  purgeLegacy();
  try {
    const key = await getKey();
    if (!key) return [];
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!stored) return [];

    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(stored);
    } catch {
      localStorage.removeItem(CHAT_HISTORY_KEY);
      return [];
    }
    if (!payload || payload.v !== 2) {
      localStorage.removeItem(CHAT_HISTORY_KEY);
      return [];
    }
    // Expired history is removed rather than returned — nothing sensitive lingers.
    if (Date.now() - payload.savedAt > CHAT_HISTORY_TTL_MS) {
      localStorage.removeItem(CHAT_HISTORY_KEY);
      return [];
    }

    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv).buffer },
      key,
      fromBase64(payload.data).buffer,
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Tampered blob, wrong key, or malformed payload — drop it and start empty.
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    } catch {
      // ignore
    }
    return [];
  }
};

export const clearChatHistory = (): void => {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(LEGACY_CHAT_HISTORY_KEY);
    sessionStorage.removeItem(CHAT_KEY_SESSION_KEY);
  } catch {
    // ignore
  }
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
