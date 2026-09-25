/** Merge class names — thin wrapper around clsx + tailwind-merge */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ').trim();
}
