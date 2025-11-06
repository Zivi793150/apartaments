"use client";
import Link from "next/link";
import { Phone, Menu, Sun, Moon, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useFavorites } from "@/components/sections/FavoritesBar";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [hasOverride, setHasOverride] = useState(false);
  const { favorites } = useFavorites();
  const favoritesCount = favorites.length;

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (stored === "light" || stored === "dark") {
      setHasOverride(true);
      setTheme(stored);
      if (stored === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      setTheme(isDark ? "dark" : "light");
      if (isDark) document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
    };
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setHasOverride(true);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  };

  const resetTheme = () => {
    localStorage.removeItem("theme");
    setHasOverride(false);
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    setTheme(isDark ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="container-xl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-3 mb-3 mx-auto w-[min(1200px,96%)] h-14 rounded-2xl border border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-lg ring-1 ring-border/30 flex items-center justify-between px-4"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: -1 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[18px] md:text-[20px] font-display tracking-tight text-foreground/90 font-bold">
                La <span className="text-brand font-bold">Srmonia</span> Costerra
              </span>
            </Link>
          </motion.div>
          <nav className="hidden md:flex items-center gap-6 text-[15px] text-muted font-semibold">
            {[
              { href: "#master", label: "План квартала" },
              { href: "#plans", label: "Планы" },
              { href: "#about", label: "О проекте" },
            ].map((item, idx) => (
              <motion.div 
                key={item.href} 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 + 0.2, duration: 0.4 }}
                whileHover={{ y: -3, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link className="hover:text-foreground link-accent transition-colors font-semibold" href={item.href}>
                  {item.label}
                </Link>
              </motion.div>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {/* Favorites button */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={() => {
                const favoritesBar = document.querySelector('[data-favorites-trigger]') as HTMLElement;
                if (favoritesBar) favoritesBar.click();
              }}
              className={`relative inline-flex items-center justify-center size-10 rounded-xl transition-all duration-300 ${
                favoritesCount > 0
                  ? "bg-red-500/10 text-red-500 ring-1 ring-red-500/20 hover:bg-red-500/20 animate-pulse-glow"
                  : "bg-surface/80 text-muted ring-1 ring-border/60 hover:bg-background opacity-50"
              }`}
              title={favoritesCount > 0 ? `Избранное (${favoritesCount})` : "Избранное"}
              disabled={favoritesCount === 0}
            >
              <Heart className={`size-5 ${favoritesCount > 0 ? "fill-current" : ""}`} />
              {favoritesCount > 0 && (
                <motion.span
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute -top-1 -right-1 bg-gradient-brand text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-background shadow-lg"
                >
                  {favoritesCount}
                </motion.span>
              )}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle theme" 
              onClick={toggleTheme} 
              title={theme === "dark" ? "Тёмная" : "Светлая"} 
              className="inline-flex items-center justify-center size-10 rounded-xl bg-surface/80 text-foreground/80 ring-1 ring-border/60 hover:bg-background transition-all duration-300"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              aria-label="Reset theme" 
              onClick={resetTheme} 
              className="hidden md:inline-flex items-center justify-center px-3 h-10 rounded-xl bg-surface/80 text-foreground/80 ring-1 ring-border/60 hover:bg-background text-sm transition-all duration-300"
            >
              Auto
            </motion.button>
            <motion.a 
              whileHover={{ scale: 1.05, y: -2 }} 
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              href="tel:+74954324768" 
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-brand text-white px-4 py-2 text-[14px] font-bold shadow-md hover:shadow-xl transition-all duration-300 btn-enhanced"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Phone className="size-4" />
              </motion.div>
              <span>+7 (495) 432-47-68</span>
            </motion.a>
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpen(true)} 
              className="md:hidden inline-flex items-center justify-center size-10 rounded-xl bg-surface/80 text-foreground/80 ring-1 ring-border/60 transition-all duration-300"
            >
              <Menu className="size-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(86%,360px)] bg-surface shadow-xl ring-1 ring-border p-5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-[18px] font-display">La <span className="text-brand">Srmonia</span> Costerra</span>
              <button onClick={() => setOpen(false)} className="text-muted text-sm">Закрыть</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/building/a" onClick={() => setOpen(false)} className="rounded-xl bg-surface p-4 text-center ring-1 ring-border hover:bg-background transition">Корпус A
                <div className="text-[11px] text-muted mt-1">с паркингом</div>
              </Link>
              <Link href="/building/b" onClick={() => setOpen(false)} className="rounded-xl bg-surface p-4 text-center ring-1 ring-border hover:bg-background transition">Корпус B
                <div className="text-[11px] text-muted mt-1">без паркинга</div>
              </Link>
            </div>
            <nav className="flex flex-col gap-3 text-[16px]">
              <Link href="#master" onClick={() => setOpen(false)} className="link-accent">План квартала</Link>
              <Link href="#plans" onClick={() => setOpen(false)} className="link-accent">Планы</Link>
              <Link href="#about" onClick={() => setOpen(false)} className="link-accent">О проекте</Link>
              {favoritesCount > 0 && (
                <button
                  onClick={() => {
                    setOpen(false);
                    const favoritesBar = document.querySelector('[data-favorites-trigger]') as HTMLElement;
                    if (favoritesBar) favoritesBar.click();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-500/10 text-red-500 px-4 py-2 text-sm ring-1 ring-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  <Heart className="w-4 h-4 fill-current" />
                  Избранное ({favoritesCount})
                </button>
              )}
              <a href="tel:+74954324768" className="mt-3 inline-flex items-center justify-center rounded-full bg-brand text-white px-5 py-2.5 text-[14px] shadow">Позвонить</a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
