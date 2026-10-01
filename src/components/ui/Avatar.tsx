import { clsx } from "../../lib/clsx";
import { initials } from "../../features/scheduling/selectors";

const SIZE = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
} as const;

/**
 * A student's picture: their uploaded photo if they have one, otherwise their initials on their
 * color. Purely decorative (the student's name is always written next to it), so it is hidden
 * from screen readers. The photo is a thumbnail this app made itself and checked on the way in
 * (`src/lib/image.ts`), so it is safe to use directly as an image source.
 */
export function Avatar({ name, color, avatar, size = "md", className }: { name: string; color: string; avatar?: string; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-bold text-white", SIZE[size], className)}
      style={{ backgroundColor: color }}
    >
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" draggable={false} /> : initials(name)}
    </span>
  );
}
