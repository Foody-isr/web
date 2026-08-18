/**
 * Decides which mounted theme provider owns the document's CSS custom
 * properties.
 *
 * More than one `ResolvedThemeProvider` is mounted on a restaurant route: the
 * `/r/[restaurantId]` layout carries the *site* palette, and the V3 page
 * renderer (or the `/order` theme bridge) nested inside it carries the *page*
 * palette. Both write the same variables on `<html>`, so ownership used to be
 * decided by whichever effect happened to run last — and that is a coin flip.
 * React flushes child effects before parent ones, but a streamed hard load
 * commits the page subtree in a *later* commit than the layout, while a
 * navigation served from the router cache commits both at once. So the page
 * palette won on a fresh load and lost on browser Back or on a warm-cache link
 * click, which repainted the order page in the bare site theme.
 *
 * Depth decides instead: the deepest mounted painter owns the document, in
 * whatever order effects run.
 */

export type ThemePainter = {
  /** Depth in the React tree — 1 for the outermost provider. */
  depth: number;
  /** Writes this provider's theme onto the document. */
  paint: () => void;
};

export type ThemeOwnership = {
  /** Mounts a painter, repaints, and returns its unmount handler. */
  register: (painter: ThemePainter) => () => void;
  /** Repaints the current owner — call when any painter's theme changes. */
  repaint: () => void;
};

/** `clearDocument` runs when the last painter unmounts. */
export function createThemeOwnership(clearDocument: () => void): ThemeOwnership {
  const painters = new Set<ThemePainter>();

  function repaint(): void {
    let owner: ThemePainter | null = null;
    // `>=` so that among equally deep painters the most recently registered
    // one wins — the incoming page during a same-depth swap.
    for (const p of painters) if (!owner || p.depth >= owner.depth) owner = p;
    if (owner) owner.paint();
    else clearDocument();
  }

  return {
    register(painter) {
      painters.add(painter);
      repaint();
      return () => {
        painters.delete(painter);
        repaint();
      };
    },
    repaint,
  };
}
