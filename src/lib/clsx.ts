/**
 * Joins CSS class names, skipping any that are `false`/`null`/`undefined`. Lets a
 * component write `clsx("btn", isActive && "btn-active")` instead of a manual
 * if/else to build the class string. "clsx" is a common name for this exact
 * pattern in the React world (this is a tiny local copy, not the npm package).
 */
export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
