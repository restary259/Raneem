
import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export const useAnimatedCounter = (end: number, duration = 2000) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 });

  useEffect(() => {
    if (inView) {
      let start = 0;
      const endValue = end;
      // Animate over a duration, irrespective of the end value
      const frameDuration = 1000 / 60; // 60fps
      const totalFrames = Math.round(duration / frameDuration);
      const increment = endValue / totalFrames;

      const counter = () => {
        start += increment;
        if (start < endValue) {
          setCount(Math.ceil(start));
          requestAnimationFrame(counter);
        } else {
          setCount(endValue);
        }
      };
      requestAnimationFrame(counter);
    }
  }, [inView, end, duration]);

  return { count, ref };
};
