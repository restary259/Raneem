
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface AnimatedCounterProps {
    value: number;
    label: string;
}

const AnimatedCounter = ({ value, label }: AnimatedCounterProps) => {
    const { count, ref } = useAnimatedCounter(value);

    return (
        <div ref={ref} className="text-center">
            <p className="text-4xl md:text-5xl font-bold text-accent drop-shadow-lg">{count.toLocaleString()}+</p>
            <p className="text-sm text-white/80">{label}</p>
        </div>
    )
}

export default AnimatedCounter;
