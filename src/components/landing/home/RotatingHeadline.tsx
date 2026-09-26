import { useEffect, useState } from "react";

/**
 * Cycles a short list of phrases with a subtle flip/slide transition.
 * Falls back to a static first phrase when the list has one item or the
 * visitor prefers reduced motion (handled in CSS).
 */
const RotatingHeadline = ({ words, intervalMs = 2600 }: { words: string[]; intervalMs?: number }) => {
  const items = Array.isArray(words) ? words.filter((word) => typeof word === "string" && word.trim().length > 0) : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [items.length, intervalMs]);

  if (items.length === 0) return null;

  return (
    <span className="darb-rotating-wrap" aria-live="polite">
      {/* Invisible longest phrase reserves the height/width so nothing jumps */}
      <span aria-hidden="true" className="darb-rotating-ghost">
        {items.reduce((longest, word) => (word.length > longest.length ? word : longest), items[0])}
      </span>
      <span key={index} className="darb-rotating-word">
        {items[index]}
      </span>
    </span>
  );
};

export default RotatingHeadline;
