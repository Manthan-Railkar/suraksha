"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Settings,
  Moon,
  Sun,
  ArrowRight,
  ShieldCheck,
  Cpu,
  BellRing,
  History,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useSearch } from "@/lib/search-context";

export default function SearchModal() {
  const { isOpen, closeSearch, toggleSearch } = useSearch();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");

  const items = [
    { label: "Door Overview", category: "Navigation", href: "/overview", icon: ShieldCheck },
    { label: "Device Health", category: "Navigation", href: "/device", icon: Cpu },
    { label: "Security Alerts", category: "Navigation", href: "/alerts", icon: BellRing },
    { label: "Event History", category: "Navigation", href: "/history", icon: History },
    { label: "System Settings", category: "Navigation", href: "/settings", icon: Settings },
    {
      label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      category: "Action",
      action: toggleTheme,
      icon: theme === "dark" ? Sun : Moon,
    },
  ];

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleSearch();
        setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSearch, toggleSearch]);

  const selectItem = (item: (typeof items)[0]) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
    closeSearch();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeSearch}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[540px] overflow-hidden rounded-[20px] border border-forest-border/40 bg-[#071f19]/95 p-4 shadow-2xl backdrop-blur-xl dark:bg-[#03140f]/95 dark:border-mint/20"
          >
            {/* Input Header */}
            <div className="relative flex items-center border-b border-forest-border/30 pb-3">
              <Search size={18} className="text-mint shrink-0 ml-1 mr-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Suraksha navigation and actions..."
                autoFocus
                className="w-full bg-transparent text-[14px] text-white placeholder-[#7fb9a6] outline-none"
              />
              <button
                onClick={closeSearch}
                className="rounded-full p-1 text-[#7fb9a6] hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results List */}
            <div className="mt-3 max-h-[340px] overflow-y-auto space-y-1 pr-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-muted">
                  No matches found for &quot;{query}&quot;
                </div>
              ) : (
                filtered.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => selectItem(item)}
                      className="group flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[13px] text-[#c9f6e8] transition-colors hover:bg-forest-card hover:text-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest/40 text-mint group-hover:bg-mint group-hover:text-forest transition-colors">
                          <Icon size={15} />
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted tracking-wide uppercase px-2 py-0.5 rounded bg-white/5">
                          {item.category}
                        </span>
                        <ArrowRight size={13} className="text-muted group-hover:text-mint group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-3 border-t border-forest-border/20 pt-2 flex items-center justify-between text-[11px] text-muted px-1">
              <span>Navigate with arrow keys</span>
              <span>
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-mint">ESC</kbd> to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
