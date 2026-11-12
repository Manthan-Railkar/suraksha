"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import {
  BellRing,
  Cpu,
  History,
  ShieldCheck,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { SIDEBAR } from "@/lib/layout";
import { useIntro } from "@/lib/intro-context";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useSearch } from "@/lib/search-context";
import { notify } from "@/components/ui/Toast";
import { useDeviceState } from "@/components/suraksha/useDeviceState";
import Logo from "./Logo";

/** `y` = icon centre, relative to the sidebar top */
const TOP = [
  { id: "overview", label: "Door Overview", icon: ShieldCheck, y: 96, href: "/overview" },
  { id: "device", label: "Device Health", icon: Cpu, y: 148, href: "/device" },
  { id: "alerts", label: "Security Alerts", icon: BellRing, y: 200, href: "/alerts" },
  { id: "history", label: "Event History", icon: History, y: 252, href: "/history" },
  { id: "settings", label: "System Settings", icon: Settings, y: 304, href: "/settings" },
] as const;

const BOTTOM = [
  { id: "search", label: "Quick Search", icon: Search, y: 372 },
  { id: "theme", label: "Toggle Theme", icon: Sun, y: 422 },
  { id: "logout", label: "Sign out", icon: LogOut, y: 472 },
] as const;

type Item = (typeof TOP)[number] | (typeof BOTTOM)[number];

const getPathId = (pathname: string): string => {
  if (pathname.startsWith("/overview") || pathname === "/") return "overview";
  if (pathname.startsWith("/device")) return "device";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/settings")) return "settings";
  return "overview";
};

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { ready } = useIntro();
  const { theme, toggleTheme } = useTheme();
  const { openSearch } = useSearch();
  const { signOut } = useAuth();
  const { data: deviceState } = useDeviceState(5000);

  const root = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(1, Math.max(0.65, (window.innerHeight - 36) / SIDEBAR.h));
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasUnackAlerts = (deviceState?.unacknowledged_alerts ?? 0) > 0;

  // Prefetch operational routes immediately
  useEffect(() => {
    TOP.forEach((it) => {
      if (it.href) {
        router.prefetch(it.href);
      }
    });
  }, [router]);

  // Auto-fit sidebar height only on exceptionally small viewports
  useEffect(() => {
    const updateScale = () => {
      const vh = window.innerHeight;
      const s = Math.min(1, Math.max(0.65, (vh - 36) / SIDEBAR.h));
      setScale(s);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Reset optimistic selection when path changes
  useEffect(() => {
    setSelectedId(null);
  }, [path]);

  const activeId = selectedId ?? getPathId(path);
  const active = TOP.find((t) => t.id === activeId) ?? TOP[0];

  // Staggered icon entrance during intro reveal
  useEffect(() => {
    if (!ready || !root.current) return;
    const items = root.current.querySelectorAll("[data-nav]");
    const tl = gsap.fromTo(
      items,
      { opacity: 0, x: -10, scale: 0.7 },
      { opacity: 1, x: 0, scale: 1, duration: 0.45, stagger: 0.045, ease: "back.out(1.6)", delay: 0.08 }
    );
    return () => {
      tl.kill();
    };
  }, [ready]);

  useEffect(() => {
    if (root.current && !ready) gsap.set(root.current.querySelectorAll("[data-nav]"), { opacity: 0 });
  }, [ready]);

  const go = (it: Item) => {
    if (it.id === "theme") {
      toggleTheme();
      notify({
        title: theme === "dark" ? "Switched to Light mode" : "Switched to Dark mode",
        description: "Adaptive palette synchronized.",
        type: "info",
      });
      return;
    }
    if (it.id === "search") {
      openSearch();
      return;
    }
    if (it.id === "logout") {
      notify({
        title: "Signed out of session",
        description: "Sign in again to monitor your door.",
        type: "info",
      });
      signOut();
      return;
    }

    if (!("href" in it) || !it.href) return;
    if (it.href === path && activeId === it.id) return;

    setSelectedId(it.id);
    router.push(it.href);
  };

  const springPhysics = {
    type: "spring" as const,
    stiffness: 440,
    damping: 32,
    mass: 0.72,
  };

  const render = (it: Item) => {
    const isTheme = it.id === "theme";
    const Icon = isTheme ? (theme === "dark" ? Moon : Sun) : it.icon;
    const label = isTheme ? (theme === "dark" ? "Light mode" : "Dark mode") : it.label;
    const on = it.id === activeId;
    const hasHref = "href" in it && Boolean(it.href);
    const showAlertDot = it.id === "alerts" && hasUnackAlerts;

    const buttonContent = (
      <>
        <motion.span
          animate={{
            scale: hover === it.id && !on ? 1.15 : 1,
            rotate: isTheme && theme === "dark" ? 360 : 0,
            color: on ? "#06372b" : isTheme && theme === "dark" ? "#b4f0db" : hover === it.id ? "#ffffff" : "#a7d3c5",
          }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="relative z-10"
        >
          <Icon size={19} strokeWidth={1.8} />
        </motion.span>

        {/* Live Security Alert Pulse */}
        {showAlertDot && (
          <span className="absolute top-[8px] right-[8px] z-20 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          </span>
        )}
      </>
    );

    if (hasHref) {
      return (
        <Link
          key={it.id}
          href={it.href!}
          prefetch={true}
          data-nav
          aria-label={label}
          onClick={(e) => {
            if (it.href === path) {
              e.preventDefault();
              return;
            }
            setSelectedId(it.id);
          }}
          onMouseEnter={() => {
            setHover(it.id);
            router.prefetch(it.href!);
          }}
          onMouseLeave={() => setHover(null)}
          className="absolute left-1/2 z-10 flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full outline-none transition-transform active:scale-95"
          style={{ top: it.y - 22 }}
        >
          {buttonContent}
        </Link>
      );
    }

    return (
      <button
        key={it.id}
        data-nav
        aria-label={label}
        onClick={() => go(it)}
        onMouseEnter={() => setHover(it.id)}
        onMouseLeave={() => setHover(null)}
        className="absolute left-1/2 z-10 flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full outline-none transition-transform active:scale-95"
        style={{ top: it.y - 22 }}
      >
        {buttonContent}
      </button>
    );
  };

  return (
    <div
      ref={root}
      className="absolute z-20"
      style={{
        left: SIDEBAR.x,
        top: SIDEBAR.y,
        width: SIDEBAR.w,
        height: SIDEBAR.h,
        transform: scale < 1 ? `scale(${scale})` : undefined,
        transformOrigin: "0 0",
      }}
    >
      {/* Sidebar background pill with frosted glass & depth */}
      <div
        className="absolute inset-0 rounded-[32px] transition-all duration-300 backdrop-blur-xl"
        style={{
          background:
            theme === "dark"
              ? "linear-gradient(180deg,#0a261f 0%,#061d16 55%,#03140f 100%)"
              : "linear-gradient(180deg,#0f362c 0%,#0a2a22 55%,#071f19 100%)",
          boxShadow:
            theme === "dark"
              ? "0 24px 44px -12px rgba(0,0,0,.78), inset 0 0 0 1px rgba(127,224,192,.18), inset 0 1px 0 rgba(255,255,255,.14)"
              : "0 24px 44px -12px rgba(4,32,24,.58), inset 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.12)",
        }}
      />

      {/* Top Logo Crown */}
      <div
        data-sidebar-logo
        className="absolute left-1/2 flex items-center justify-center text-[#c9f6e8]"
        style={{ top: 25, transform: "translateX(-50%)", width: 28, height: 24 }}
      >
        <Logo size={28} />
      </div>

      {/* Sliding mint orb + right-edge notch in lockstep spring physics */}
      <motion.div
        className="pointer-events-none absolute left-1/2 z-[5] -ml-[23px] h-[46px] w-[46px] rounded-full"
        style={{
          top: -23,
          background: "radial-gradient(circle at 35% 28%,#d3fbee 0%,#8ee6c8 55%,#6fd6b4 100%)",
          boxShadow: "0 0 22px rgba(127,224,192,.55), inset 0 1px 0 rgba(255,255,255,.7)",
        }}
        initial={false}
        animate={{ y: active.y }}
        transition={springPhysics}
      />
      <motion.div
        className="pointer-events-none absolute z-[4] h-[24px] w-[14px] rounded-r-[14px] bg-[#071f19] dark:bg-[#03140f] transition-colors"
        style={{ left: SIDEBAR.w - 4, top: -12 }}
        initial={false}
        animate={{ y: active.y }}
        transition={springPhysics}
      />

      {/* Main Security Nav Items */}
      {TOP.map(render)}

      {/* Subtle Divider Line */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[28px] h-[1px] bg-gradient-to-r from-transparent via-[#7fe0c0]/25 to-transparent"
        style={{ top: 338 }}
      />

      {/* Utility / Control Items */}
      {BOTTOM.map(render)}

      {/* Tooltip on hover */}
      <AnimatePresence>
        {hover && (() => {
          const it = [...TOP, ...BOTTOM].find((i) => i.id === hover);
          if (!it) return null;
          const isTheme = it.id === "theme";
          const label = isTheme ? (theme === "dark" ? "Light mode" : "Dark mode") : it.label;
          return (
            <motion.div
              key={hover}
              initial={{ opacity: 0, x: -6, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -4, scale: 0.95 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute z-30 -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-forest border border-white/10 px-[10px] py-[6px] text-[10px] font-medium text-white shadow-[0_8px_20px_-6px_rgba(4,32,24,.5)]"
              style={{ left: SIDEBAR.w + 20, top: it.y }}
            >
              {label}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
