"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

export function useAnimeIn(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(18px)";
    animate(el, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 520,
      ease: "out(3)",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useAnimeStagger(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;
    children.forEach(c => { c.style.opacity = "0"; c.style.transform = "translateY(20px)"; });
    animate(children, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(65),
      duration: 460,
      ease: "out(3)",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function AnimatedIn({ children, className, style, delay = 0 }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    animate(el, { opacity: [0, 1], translateY: [16, 0], duration: 480, delay, ease: "out(3)" });
  }, [delay]);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
