
import { useInView } from 'react-intersection-observer';

export const useScrollAnimation = (delay = 0) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const style = delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: 'forwards' as const } : { animationFillMode: 'forwards' as const };

  return {
    ref,
    className: inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0',
    style,
  };
};
