"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { isMobileTabQuery } from "@/lib/mobileExperience";

type TabState = {
  scrollTop: number;
  orderQuery: string;
  values: Map<string, unknown>;
  loadedAt: number;
};
type TabPage = { content: ReactNode; state: TabState };
type TabPages = {
  pages: Map<string, TabPage>;
  paths: Set<string>;
  enabled: boolean;
  remember: (path: string, content: ReactNode) => void;
  navigate: (href: string) => boolean;
};

const PageContext = createContext<TabPages | null>(null);
const StateContext = createContext<TabState | null>(null);

function tabPath(href: string) {
  return href.split("?")[0].replace(/\/$/, "") || "/";
}

/** A tab can reopen its local page through the same link and browser history. */
export function useMobileTabLink() {
  const cache = useContext(PageContext);
  return {
    loaded: (href: string) => cache?.pages.has(tabPath(href)) ?? false,
    navigate: (href: string) => cache?.navigate(href) ?? false,
  };
}

/** Stores transient controls with the page while that installed tab is inactive. */
export function useMobileTabState<T>(key: string, initialValue: T) {
  const screen = useContext(StateContext);
  const [value, setValue] = useState<T>(() => screen?.values.has(key) ? screen.values.get(key) as T : initialValue);
  useLayoutEffect(() => {
    screen?.values.set(key, value);
  }, [screen, key, value]);
  return [value, setValue] as const;
}

/** Returns when the visible tab was loaded so live queries can revalidate their data. */
export function useMobileTabLoadedAt() {
  return useContext(StateContext)?.loadedAt;
}

/** Receives the first server-rendered view of a tab and hands it to the restaurant layout. */
export function MobileTabPage({ pathname, children }: { pathname: string; children: ReactNode }) {
  const cache = useContext(PageContext);
  const path = tabPath(pathname);
  const capture = cache?.enabled && cache.paths.has(path);
  const remember = cache?.remember;
  useLayoutEffect(() => {
    if (capture) remember?.(path, children);
  }, [capture, remember, path, children]);
  return capture || cache?.pages.has(path) ? null : children;
}

/** Holds the loaded views of the configured tabs for this restaurant and app session. */
export function MobileTabPages({ enabled, tabHrefs, children, navigation }: {
  enabled: boolean;
  tabHrefs: string[];
  children: ReactNode;
  navigation: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pages, setPages] = useState(() => new Map<string, TabPage>());
  const paths = new Set(tabHrefs.map(tabPath));
  const remember = useCallback((path: string, content: ReactNode) => {
    setPages(previous => {
      const page = previous.get(path);
      if (page?.content === content) return previous;
      const state = page?.state ?? { scrollTop: 0, orderQuery: "", values: new Map(), loadedAt: Date.now() };
      return new Map(previous).set(path, { content, state });
    });
  }, []);
  const activePath = tabPath(pathname);
  const cart = activePath === "/order/cart";
  const cartSource = cart && typeof window !== "undefined" ? window.history.state?.foodyCartSource : undefined;
  const sourcePath = typeof cartSource === "string" ? tabPath(cartSource) : undefined;
  const page = cart ? (sourcePath ? pages.get(sourcePath) : undefined) : isMobileTabQuery(searchParams.keys()) ? pages.get(activePath) : undefined;
  const state = page?.state;
  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    if (!enabled || url.origin !== window.location.origin) return false;
    const targetPath = tabPath(url.pathname);
    const currentPath = tabPath(window.location.pathname);
    if (state && targetPath !== currentPath) state.scrollTop = window.scrollY;
    const target = pages.get(targetPath);
    if (!target) return false;
    if (currentPath === targetPath) return true;
    for (const [key, value] of new URLSearchParams(target.state.orderQuery)) url.searchParams.set(key, value);
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    return true;
  }, [enabled, pages, state]);

  useLayoutEffect(() => {
    if (!state || cart) return;
    window.scrollTo({ top: state.scrollTop, behavior: "instant" });
    const rememberScroll = () => {
      if (tabPath(window.location.pathname) === activePath) state.scrollTop = window.scrollY;
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, [activePath, cart, state]);

  useEffect(() => {
    if (!state || cart) return;
    const orderQuery = new URLSearchParams();
    for (const key of ["browse", "service"]) {
      const value = searchParams.get(key);
      if (value) orderQuery.set(key, value);
    }
    state.orderQuery = orderQuery.toString();
  }, [cart, searchParams, state]);

  const context = { pages, paths, enabled, remember, navigate };
  return (
    <PageContext.Provider value={context}>
      <div className={page ? "hidden" : "contents"}>{children}</div>
      {page && (
        <StateContext.Provider key={cart ? sourcePath : activePath} value={page.state}>
          {page.content}
        </StateContext.Provider>
      )}
      {navigation}
    </PageContext.Provider>
  );
}
