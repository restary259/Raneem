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
        ? "-end-12 -top-20 h-64 w-44 rounded-t-full border-b-0 sm:-end-8 sm:h-80 sm:w-56 lg:end-[4%] lg:top-14 lg:h-[30rem] lg:w-80 lg:border-[14px]"
        : "-end-5 -top-5 h-[72%] w-[58%] rounded-t-full border-b-0 border-darb-yellow/90",
      className,
    )}
  >
    <span className="absolute -inset-[28px] rounded-t-full border-[8px] border-darb-orange/80 border-b-0" />
    <span className="absolute -inset-[47px] rounded-t-full border-[7px] border-darb-pink/75 border-b-0" />
  </div>
);

export default BrandArch;
