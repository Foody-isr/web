/** Returns the longest leading group that fits, reserving the overflow control only when needed. */
export function visibleHeaderLinks(
  widths: readonly number[],
  available: number,
  gap: number,
  moreWidth: number,
): number {
  if (
    widths.reduce((total, width) => total + width, 0) +
      Math.max(0, widths.length - 1) * gap <=
    available
  )
    return widths.length;
  let used = moreWidth;
  let count = 0;
  for (const width of widths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count++;
  }
  return count;
}
