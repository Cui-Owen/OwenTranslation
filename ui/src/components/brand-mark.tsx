import { cn } from "@/lib/utils";

// 朱批 mark: an O cut horizontally, the lower (translation) half shifted one
// step down-right. The lower half turns vermilion once a page is translated.
export function BrandMark({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <path d="M10 30a20 20 0 0 1 40 0" fill="none" stroke="var(--mark-upper)" strokeWidth="9" />
      <path
        d="M54 34a20 20 0 0 1-40 0"
        fill="none"
        stroke={active ? "var(--mark-lower)" : "var(--mark-idle)"}
        strokeWidth="9"
        className="transition-[stroke] duration-300"
      />
    </svg>
  );
}
