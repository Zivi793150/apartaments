"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ApartmentShowcase from "@/components/sections/ApartmentShowcase";
import InvestmentRegions from "@/components/sections/InvestmentRegions";
import ApartmentStickyCTA from "@/components/sections/ApartmentStickyCTA";
import { useFavorites } from "@/components/sections/FavoritesBar";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

type ViewMode = "plan" | "visual";

export default function ApartmentPage() {
  const { id } = useParams<{ id?: string }>();
  const safeId = (id ?? "A-1-1").toString();
  const [view, setView] = useState<ViewMode>("plan");
  const visuals = ["/images/arch-3.jpg", "/images/arch-2.jpg", "/images/arch-1.jpg"];
  const plan = "/images/plan-3d-1.jpg";
  const router = useRouter();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  
  // Примерные данные квартиры для избранного
  const apartmentData = { id: safeId, area: 88.7, rooms: 2 };
  
  const handleFavoriteToggle = () => {
    if (isFavorite(safeId)) {
      removeFavorite(safeId);
    } else {
      addFavorite(apartmentData);
    }
  };

  return (
    <main className="container-xl pb-20 mt-10">
      {/* Back button (mobile) */}
      <div className="md:hidden fixed top-3 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => router.back()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-background/95 backdrop-blur-md px-4 py-2 text-brand font-medium text-lg shadow-lg ring-1 ring-border/50"
        >
          ← К фасаду
        </motion.button>
      </div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl md:text-3xl font-medium"
        >
          Квартира {safeId}
        </motion.h1>
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onClick={handleFavoriteToggle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-2.5 rounded-lg transition-colors ${
              isFavorite(safeId)
                ? "bg-red-500/10 text-red-500"
                : "bg-surface hover:bg-background text-muted hover:text-red-500 ring-1 ring-border"
            }`}
          >
            <Heart className={`w-5 h-5 ${isFavorite(safeId) ? "fill-current" : ""}`} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => router.back()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-surface ring-1 ring-border px-4 py-2 text-muted hover:text-brand hover:bg-background transition-all duration-300"
          >
            ← К фасаду
          </motion.button>
        </div>
      </div>
      <section className="grid gap-6 md:grid-cols-[0.9fr,1.1fr]">
        {/* Sidebar info */}
        <aside className="rounded-2xl bg-white ring-1 ring-border shadow-xl p-6 flex flex-col gap-5 md:sticky md:top-20 h-fit">
          <div>
            <div className="text-[clamp(44px,9vw,86px)] leading-none font-display" style={{ color: "var(--brand-foreground)" }}>4E</div>
            <div className="mt-2 text-muted text-sm">Корпус A • 6 этаж</div>
          </div>
          {/* Минималистичные строки характеристик */}
          <div className="flex flex-col divide-y divide-border text-[15px]">
            {[
              { k: "Площадь", v: "88.7 м²" },
              { k: "Комнат", v: "2" },
              { k: "Окна", v: "во двор" },
              { k: "Отделка", v: "White box" },
            ].map((row) => (
              <div key={row.k} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-muted whitespace-nowrap">{row.k}</span>
                <span className="text-foreground/90 break-words text-right">{row.v}</span>
              </div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-foreground text-background p-5 mt-2 shadow-lg"
          >
            <div className="text-sm opacity-80">Стоимость</div>
            <div className="text-2xl md:text-3xl font-medium">43 462 130 ₽</div>
            <div className="text-xs opacity-60 line-through mt-1">47 232 750 ₽</div>
          </motion.div>
          <div className="flex gap-3 mt-1">
            <motion.a
              href="#"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 inline-flex items-center justify-center rounded-full bg-brand text-white px-5 py-2.5 text-sm shadow-md hover:shadow-lg transition-all duration-300 btn-enhanced"
            >
              Забронировать
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center rounded-full bg-surface ring-1 ring-border px-5 py-2.5 text-sm hover:bg-background transition-colors"
            >
              PDF
            </motion.a>
          </div>
        </aside>
        {/* Viewer */}
        <div className="rounded-2xl bg-white ring-1 ring-border shadow-lg p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 sticky top-16 z-10 bg-white/95 backdrop-blur-sm -mx-3 md:-mx-6 px-3 md:px-6 pt-3 md:pt-6 -mt-3 md:-mt-6 pb-3">
            <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border">
              {[{k:"plan",t:"План"},{k:"visual",t:"Визуал"}].map(({k,t}) => (
                <motion.button
                  key={k}
                  onClick={() => setView(k as ViewMode)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 text-sm rounded-full transition-all duration-300 ${view===k?"bg-brand text-white shadow-md":"text-muted hover:text-foreground"}`}
                >
                  {t}
                </motion.button>
              ))}
            </div>
            <div className="text-xs text-muted font-medium">№ {safeId}</div>
          </div>
          <div className="relative w-full overflow-hidden rounded-xl will-change-transform">
            <motion.div
              key={view}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {view === "plan" ? (
                <div className="relative w-full h-0 pb-[56%] rounded-xl overflow-hidden bg-surface">
                  <Image src={plan} alt="План квартиры" fill className="object-contain" sizes="100vw" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {visuals.map((src, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      className="relative w-full h-0 pb-[70%] rounded-xl overflow-hidden group cursor-pointer"
                    >
                      <Image src={src} alt={`Визуализация ${i+1}`} fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="50vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Секция с красивыми эффектами как у ever */}
      <ApartmentShowcase />

      {/* Инвестиционная секция */}
      <InvestmentRegions />
      <ApartmentStickyCTA id={safeId} />
    </main>
  );
}
