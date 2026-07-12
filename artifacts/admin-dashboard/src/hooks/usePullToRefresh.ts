/**
 * usePullToRefresh
 *
 * Native Android pull-to-refresh gesture on a scroll container. Only
 * ever touches React Query's cache (`invalidateQueries`) — never
 * reloads the WebView or the page, and never touches realtime
 * subscriptions. No-op on web/desktop; the container ref should still
 * be attached unconditionally so callers don't need to branch.
 */

import { useEffect, useRef, useState } from "react";
import { isNativeAndroid } from "@/native/platform";

const PULL_THRESHOLD = 64;
const MAX_PULL = 110;
const PULL_RESISTANCE = 0.5;

export function usePullToRefresh<T extends HTMLElement>(onRefresh: () => Promise<void>) {
  const containerRef = useRef<T | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!isNativeAndroid()) return;

    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let dragging = false;
    let currentPull = 0;
    let isRefreshing = false;

    const setPull = (value: number) => {
      currentPull = value;
      setPullDistance(value);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (isRefreshing || el.scrollTop > 0) return;
      dragging = true;
      startY = event.touches[0]!.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!dragging || isRefreshing) return;

      const delta = event.touches[0]!.clientY - startY;
      if (delta <= 0 || el.scrollTop > 0) {
        dragging = false;
        setPull(0);
        return;
      }

      event.preventDefault();
      setPull(Math.min(delta * PULL_RESISTANCE, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;

      if (currentPull >= PULL_THRESHOLD) {
        isRefreshing = true;
        setRefreshing(true);
        setPull(PULL_THRESHOLD);

        void onRefreshRef.current().finally(() => {
          isRefreshing = false;
          setRefreshing(false);
          setPull(0);
        });
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return { containerRef, pullDistance, refreshing, isNative: isNativeAndroid() };
}
