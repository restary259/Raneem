import jsPDF from 'jspdf';

const FONT_URL = 'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUqkJA.ttf';
let fontBase64: string | null = null;
let loadingPromise: Promise<string> | null = null;

async function fetchFontBase64(): Promise<string> {
  if (fontBase64) return fontBase64;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(FONT_URL)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch Arabic font');
      return res.arrayBuffer();
    })
    .then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
      return fontBase64;
    });

  return loadingPromise;
}

/**
 * Registers the Amiri Arabic font with a jsPDF instance.
 * Call this before rendering any Arabic text.
 */
export async function registerArabicFont(doc: jsPDF): Promise<void> {
  try {
    const base64 = await fetchFontBase64();
    doc.addFileToVFS('Amiri-Regular.ttf', base64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
  } catch (e) {
    console.warn('Could not load Arabic font, falling back to default:', e);
  }
}

/**
 * Reverses Arabic/Hebrew text segments for proper RTL rendering in jsPDF.
 * jsPDF doesn't support RTL natively, so we reverse the character order
 * for Arabic text segments.
 */
export function processArabicText(text: string): string {
  // Check if text contains Arabic characters
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (!arabicRegex.test(text)) return text;

  // Reverse the entire string for Arabic (simple RTL fix)
  return text.split('').reverse().join('');
}
