"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import Logo from "./Logo";
import { computeStage, getSidebarLogoCoords } from "@/lib/layout";

/**
 * Timeline (seconds):
 *  0.00  logo draws in at screen centre on the dark vignette, caption fades up, glow breathes
 *  0.70  center loading complete: brief hold
 *  0.85  caption fades out completely at centre (text disappears after center loading is done)
 *  1.10  caption hidden, logo flies smoothly to exact sidebar logo coordinates (overlap)
 *  1.60  mint circle expands from the logo and reveals the dashboard
 *  1.85  pages receive `ready` → skeleton cards, typing, counters, bars
 *  2.45  intro layer removed, clipPath cleared
 */
export default function Intro({
  bgRef,
  revealRef,
  onReady,
}: {
  bgRef: RefObject<HTMLDivElement>;
  revealRef: RefObject<HTMLDivElement>;
  onReady: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const logoSvg = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const reveal = revealRef.current!,
      bg = bgRef.current!,
      el = wrap.current!,
      cap = caption.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      reveal.style.clipPath = "none";
      bg.style.display = "none";
      el.style.display = "none";
      cap.style.display = "none";
      onReady();
      return;
    }

    const { vw, vh } = computeStage();
    const { cx, cy, scale: targetScale } = getSidebarLogoCoords();
    const R = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) + 24;
    const proxy = { r: 0 };
    const clip = () => {
      reveal.style.clipPath = `circle(${proxy.r}px at ${cx}px ${cy}px)`;
    };

    const ctx = gsap.context(() => {
      clip();
      const bars = el.querySelectorAll<SVGPathElement>("[data-logo-bar]");
      bars.forEach((b) => {
        const l = b.getTotalLength();
        gsap.set(b, { strokeDasharray: l, strokeDashoffset: l });
      });

      // Center logo setup (28x24 box)
      const centerScale = 1.6;
      gsap.set(el, {
        x: vw / 2,
        y: vh / 2,
        xPercent: -50,
        yPercent: -50,
        scale: centerScale,
        opacity: 1,
      });

      // Center caption setup - isolated from moving logo so it stays in center and disappears
      gsap.set(cap, {
        x: vw / 2,
        y: vh / 2 + 28,
        xPercent: -50,
        yPercent: 0,
        opacity: 0,
      });

      const tl = gsap.timeline();

      // Phase 1: Center loading (drawing bars, caption fades up, glow breathes)
      tl.to(bars, { strokeDashoffset: 0, duration: 0.55, stagger: 0.1, ease: "power2.out" }, 0.05)
        .to(cap, { opacity: 0.85, y: vh / 2 + 24, duration: 0.5, ease: "power2.out" }, 0.2)
        .fromTo(
          glow.current,
          { scale: 0.9, opacity: 0.5 },
          { scale: 1.15, opacity: 0.95, duration: 1.2, ease: "sine.inOut" },
          0
        )

        // Phase 2: Center loading is done -> Text disappears completely at the center before logo leaves
        .to(cap, { opacity: 0, y: vh / 2 + 28, duration: 0.25, ease: "power2.in" }, 0.85)
        .set(cap, { display: "none" }, 1.1)

        // Phase 3: Logo flies smoothly to exact sidebar logo coordinates and scale
        .to(el, { x: cx, y: cy, scale: targetScale, duration: 0.55, ease: "power3.inOut" }, 1.1)
        .to(glow.current, { opacity: 0, duration: 0.35 }, 1.15)
        .to(
          logoSvg.current,
          { filter: "drop-shadow(0 0 0 rgba(127,224,192,0))", duration: 0.5, ease: "power2.out" },
          1.15
        )

        // Phase 4: Reveal circle expands from the logo coordinates
        .to(proxy, { r: R, duration: 0.85, ease: "power2.inOut", onUpdate: clip }, 1.6)
        .call(onReady, undefined, 1.85)
        .to(bg, { opacity: 0, duration: 0.35 }, 2.3)
        .set(el, { display: "none" }, 2.45)
        .call(
          () => {
            reveal.style.clipPath = "none";
            bg.style.display = "none";
          },
          undefined,
          2.5
        );
    });

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Intro Flying Logo */}
      <div
        ref={wrap}
        className="pointer-events-none fixed left-0 top-0 z-30 flex items-center justify-center text-[#c9f6e8] opacity-0"
        style={{ width: 28, height: 24 }}
      >
        <div
          ref={glow}
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(40,150,115,.28) 0%, transparent 62%)" }}
        />
        <div ref={logoSvg} className="relative transition-all duration-300">
          <Logo size={28} className="drop-shadow-[0_0_14px_rgba(127,224,192,.55)]" />
        </div>
      </div>

      {/* Intro Caption: Stays pinned to center loading area and vanishes in place */}
      <div
        ref={caption}
        className="pointer-events-none fixed left-0 top-0 z-30 whitespace-nowrap text-center opacity-0"
      >
        <p className="font-serif text-[10px] italic tracking-wider text-[#7fb9a6]">
          Team Workspace
        </p>
      </div>
    </>
  );
}
