import { cn } from "@/lib/utils";

type BrandArchProps = {
  className?: string;
  variant?: "hero" | "frame";
};

const BrandArch = ({ className, variant = "hero" }: BrandArchProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute border-[10px] border-brand/90",
      variant === "hero"
        ? "end-14 -top-16 h-64 w-40 rounded-t-full border-b-0 sm:end-16 sm:h-80 sm:w-52 lg:end-[4%] lg:top-14 lg:h-[30rem] lg:w-80 lg:border-[14px]"
        : "end-14 top-16 h-[62%] w-[48%] rounded-t-full border-b-0 border-[#FFC107]/90",
      className,
    )}
  >
    <span className="absolute -inset-[28px] rounded-t-full border-[8px] border-[#FF8A00]/80 border-b-0" />
    <span className="absolute -inset-[47px] rounded-t-full border-[7px] border-[#FF4DA6]/75 border-b-0" />
  </div>
);

export default BrandArch;
