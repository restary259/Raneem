
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface AnimatedCounterProps {
    end: number;
}

const AnimatedCounter = ({ end }: AnimatedCounterProps) => {
    const { count, ref } = useAnimatedCounter(end);

    return (
        <span ref={ref}>{count.toLocaleString()}</span>
    );
}

export default AnimatedCounter;
