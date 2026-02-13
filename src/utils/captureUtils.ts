/**
 * Capture a DOM element as an image using canvas.
 * Uses foreignObject SVG approach for cross-browser support.
 */
export async function captureElementAsImage(
  elementId: string,
  format: 'png' | 'jpeg' = 'png',
  filename?: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const rect = element.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  // Get computed styles and inline them
  const allElements = clone.querySelectorAll('*');
  const originalElements = element.querySelectorAll('*');
  
  allElements.forEach((el, i) => {
    const orig = originalElements[i];
    if (orig && el instanceof HTMLElement) {
      const computed = window.getComputedStyle(orig);
      const important = [
        'font-family', 'font-size', 'font-weight', 'font-style',
        'color', 'background-color', 'background',
        'border', 'border-radius', 'padding', 'margin',
        'text-align', 'line-height', 'letter-spacing',
        'display', 'flex-direction', 'align-items', 'justify-content',
        'gap', 'width', 'height', 'min-height', 'max-width',
        'overflow', 'white-space', 'word-break',
        'box-shadow', 'opacity'
      ];
      important.forEach(prop => {
        el.style.setProperty(prop, computed.getPropertyValue(prop));
      });
    }
  });

  // Also inline styles on the clone root
  const rootComputed = window.getComputedStyle(element);
  ['background-color', 'background', 'color', 'font-family', 'padding'].forEach(prop => {
    clone.style.setProperty(prop, rootComputed.getPropertyValue(prop));
  });

  // Serialize to SVG foreignObject
  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  document.body.removeChild(clone);

  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${html}
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // High DPI
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.scale(scale, scale);
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }

          const ext = format === 'jpeg' ? 'jpg' : 'png';
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename || `lebenslauf.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          resolve();
        },
        `image/${format}`,
        format === 'jpeg' ? 0.95 : undefined
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}
