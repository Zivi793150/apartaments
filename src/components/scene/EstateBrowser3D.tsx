"use client";
import React, { useRef, useState, useEffect } from "react";
import BuildingScene3D, { type SceneFilter, type PickedUnit } from "./BuildingScene3D";
import BuildingHotspots from "./BuildingHotspots";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, ExternalLink, Maximize2 } from "lucide-react";
import { useFavorites, type FavoriteApartment } from "@/components/sections/FavoritesBar";
import Link from "next/link";

function parseId(id: string) {
  // формат: A-4-3 => {building:'A', floor:'4', unit:'3'}
  const parts = id.split("-");
  return { building: parts[0] ?? "", floor: parts[1] ?? "", unit: parts[2] ?? "" };
}

export default function EstateBrowser3D() {
  const [filter, setFilter] = useState<SceneFilter>({ activeBuilding: "a", rooms: null, onlyAvailable: false, hoverFloor: null });
  const [picked, setPicked] = useState<PickedUnit>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const set = (patch: Partial<SceneFilter>) => setFilter(prev => ({ ...prev, ...patch }));

  const buildingTabs = [{ k: "a", t: "Корпус A" }, { k: "b", t: "Корпус B" }] as const;

  const previewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (picked && previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      const top = window.pageYOffset + rect.top - 140;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [picked]);

  const handleFavoriteToggle = (apt: PickedUnit) => {
    if (!apt) return;
    if (isFavorite(apt.id)) {
      removeFavorite(apt.id);
    } else {
      addFavorite({ id: apt.id, area: apt.area, rooms: apt.rooms });
    }
  };

  return (
    <div>
      <div className="relative">
        {/* Top controls above scene */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 left-0 right-0 top-3 flex items-center justify-center gap-3 flex-wrap"
        >
          <div className="inline-flex bg-background/85 backdrop-blur-md rounded-full ring-1 ring-border/60 p-1 shadow-lg">
            {buildingTabs.map(({ k, t }) => (
              <motion.div
                key={k}
                className="relative"
                whileHover="hover"
                initial="rest"
              >
                <motion.button
                  onClick={() => set({ activeBuilding: k as any })}
                  aria-pressed={filter.activeBuilding===k}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-1.5 sm:px-5 sm:py-2 text-sm rounded-full transition-all duration-200 font-semibold relative ${
                    filter.activeBuilding===k
                      ? "bg-gradient-brand text-white shadow-md"
                      : "text-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  {t}
                </motion.button>
                {/* Parking tooltip */}
                <motion.div
                  variants={{
                    hover: { opacity: 1, y: 0, pointerEvents: "auto" },
                    rest: { opacity: 0, y: -5, pointerEvents: "none" }
                  }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-bold whitespace-nowrap shadow-lg z-50"
                >
                  {k === "a" ? "✓ С паркингом" : "Без паркинга"}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
                </motion.div>
              </motion.div>
            ))}
          </div>
          <motion.button 
            onClick={() => set({ onlyAvailable: !filter.onlyAvailable })} 
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-sm ring-1 shadow-md transition-all duration-200 font-semibold ${
              filter.onlyAvailable
                ? "bg-gradient-brand text-white ring-brand shadow-lg"
                : "ring-border/60 bg-background/85 backdrop-blur-md hover:bg-surface/50"
            }`}
          >
            Свободные
          </motion.button>
        </motion.div>

        <BuildingScene3D filter={filter} onPick={setPicked} />
        
        {/* Animated hotspots/hints */}
        <BuildingHotspots 
          activeBuilding={filter.activeBuilding} 
          onHotspotClick={(hotspot) => {
            set({ hoverFloor: hotspot.floor });
          }}
        />

        {/* Bottom controls - Mobile adapted */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute z-10 left-0 right-0 bottom-2 flex items-center justify-center px-2 sm:px-0"
        >
          <div className="w-full max-w-[calc(100vw-16px)] sm:max-w-none overflow-x-auto scrollbar-hide">
            <div className="inline-flex bg-background/85 backdrop-blur-md rounded-full ring-1 ring-border/60 p-1 shadow-lg mx-auto">
              {[1,2,3,4].map(r => (
                <motion.button 
                  key={r} 
                  onClick={() => set({ rooms: filter.rooms===r? null : r as any })} 
                  whileTap={{ scale: 0.92 }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full transition-all duration-200 font-semibold whitespace-nowrap ${
                    filter.rooms===r
                      ? "bg-gradient-brand text-white shadow-md"
                      : "text-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  {r}к
                </motion.button>
              ))}
              <span className="mx-1 sm:mx-1.5 w-px h-4 sm:h-5 bg-border/60" />
              {[1,2,3,4,5,6].map(f => (
                <motion.button 
                  key={f} 
                  onClick={() => set({ hoverFloor: filter.hoverFloor===f ? null : f })} 
                  whileTap={{ scale: 0.92 }}
                  className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full transition-all duration-200 font-semibold whitespace-nowrap ${
                    filter.hoverFloor===f
                      ? "bg-gradient-brand text-white shadow-md"
                      : "text-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  {f}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Slide-up preview below the scene */}
      <AnimatePresence>
        {picked && (
          <motion.div
            ref={previewRef}
            key={picked.id}
            initial={{ opacity: 0, y: 28, clipPath: "inset(0 0 100% 0)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
            exit={{ opacity: 0, y: 28, clipPath: "inset(0 0 100% 0)" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="mx-auto mt-3 max-w-[980px] md:max-w-[1100px]"
          >
            <div className="rounded-2xl bg-white/95 dark:bg-background/90 backdrop-blur-md ring-1 ring-border shadow-2xl p-4 md:p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="text-lg md:text-xl font-bold text-foreground"
                  >
                    {picked.id}
                  </motion.div>
                  <Chips id={picked.id} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted hidden sm:block font-semibold">{picked.area} м² · {picked.rooms}к</div>
                  <motion.button
                    onClick={() => handleFavoriteToggle(picked)}
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    whileTap={{ scale: 0.85, rotate: -5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className={`p-2 rounded-lg transition-colors ${
                      isFavorite(picked.id)
                        ? "bg-red-500/10 text-red-500 animate-pulse-glow"
                        : "bg-surface hover:bg-background text-muted hover:text-red-500 ring-1 ring-border"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(picked.id) ? "fill-current" : ""}`} />
                  </motion.button>
                  <motion.button
                    onClick={() => setPicked(null)}
                    whileHover={{ scale: 1.15, rotate: 90 }}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="p-2 rounded-lg bg-surface hover:bg-background text-muted hover:text-foreground ring-1 ring-border transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="relative w-full h-48 md:h-56 rounded-xl overflow-hidden ring-1 ring-border group cursor-pointer"
                  onClick={() => setShowQuickView(true)}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent pointer-events-none z-10" />
                  <img src="/images/plan-3d-1.jpg" alt="План" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center z-20">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileHover={{ scale: 1 }}
                      className="hidden group-hover:flex items-center gap-2 text-white bg-white/20 backdrop-blur rounded-full px-4 py-2 text-sm font-medium"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Быстрый просмотр
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                      className="rounded-xl bg-surface p-3 ring-1 ring-border card-hover"
                    >
                      <div className="text-xs text-muted mb-1 font-semibold">Площадь</div>
                      <div className="text-lg font-bold">{picked.area} м²</div>
                    </motion.div>
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                      className="rounded-xl bg-surface p-3 ring-1 ring-border card-hover"
                    >
                      <div className="text-xs text-muted mb-1 font-semibold">Комнат</div>
                      <div className="text-lg font-bold">{picked.rooms}</div>
                    </motion.div>
                  </div>
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                    className="rounded-xl bg-surface p-4 ring-1 ring-border card-hover"
                  >
                    <div className="text-xs text-muted mb-2 font-semibold">Характеристики</div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">Корпус</span>
                        <span className="font-bold">{picked.id.split("-")[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">Этаж</span>
                        <span className="font-bold">{picked.id.split("-")[1]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">Статус</span>
                        <span className="font-bold text-brand">Доступна</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/apartment/${picked.id}`} className="flex-1">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand text-white px-5 py-2.5 text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 btn-enhanced"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть план
                  </motion.button>
                </Link>
                <motion.button 
                  onClick={() => setShowQuickView(true)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="px-5 py-2.5 rounded-full ring-1 ring-border bg-surface hover:bg-background text-sm font-bold transition-all duration-300"
                >
                  <Maximize2 className="w-4 h-4 inline mr-2" />
                  <span className="hidden sm:inline">Быстрый просмотр</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <AnimatePresence>
        {showQuickView && picked && (
          <QuickViewModal
            apartment={picked}
            isFavorite={isFavorite(picked.id)}
            onFavoriteToggle={() => handleFavoriteToggle(picked)}
            onClose={() => setShowQuickView(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Chips({ id }: { id: string }) {
  const p = parseId(id);
  return (
    <div className="inline-flex items-center gap-1">
      {p.building && (<span className="px-2 py-0.5 text-[11px] rounded-full bg-brand/10 text-brand ring-1 ring-brand/20 font-medium">Корпус {p.building}</span>)}
      {p.floor && (<span className="px-2 py-0.5 text-[11px] rounded-full bg-surface ring-1 ring-border">Этаж {p.floor}</span>)}
      {p.unit && (<span className="px-2 py-0.5 text-[11px] rounded-full bg-surface ring-1 ring-border">Кв. {p.unit}</span>)}
    </div>
  );
}

function QuickViewModal({
  apartment,
  isFavorite,
  onFavoriteToggle,
  onClose,
}: {
  apartment: NonNullable<PickedUnit>;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  onClose: () => void;
}) {
  const visuals = ["/images/arch-3.jpg", "/images/arch-2.jpg", "/images/arch-1.jpg"];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-foreground/70 backdrop-blur-md z-50"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(95vw,1000px)] md:max-h-[90vh] bg-background rounded-3xl shadow-2xl ring-1 ring-border z-[60] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-medium">{apartment.id}</h2>
            <p className="text-sm text-muted mt-1">{apartment.area} м² · {apartment.rooms} комнат</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onFavoriteToggle}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`p-2.5 rounded-lg transition-colors ${
                isFavorite
                  ? "bg-red-500/10 text-red-500"
                  : "bg-surface hover:bg-background text-muted hover:text-red-500 ring-1 ring-border"
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
            </motion.button>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2.5 rounded-lg bg-surface hover:bg-background text-muted hover:text-foreground ring-1 ring-border transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="relative w-full h-64 rounded-xl overflow-hidden ring-1 ring-border">
                <img src="/images/plan-3d-1.jpg" alt="План" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {visuals.map((src, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    className="relative w-full h-32 rounded-lg overflow-hidden ring-1 ring-border cursor-pointer"
                  >
                    <img src={src} alt={`Визуализация ${i+1}`} className="absolute inset-0 w-full h-full object-cover" />
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-surface p-5 ring-1 ring-border">
                <h3 className="font-medium mb-3">Характеристики</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Площадь</span>
                    <span className="font-medium">{apartment.area} м²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Комнат</span>
                    <span className="font-medium">{apartment.rooms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Корпус</span>
                    <span className="font-medium">{apartment.id.split("-")[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Этаж</span>
                    <span className="font-medium">{apartment.id.split("-")[1]}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-foreground text-background p-5">
                <div className="text-sm opacity-80 mb-1">Стоимость</div>
                <div className="text-2xl font-medium">43 462 130 ₽</div>
                <div className="text-xs opacity-60 line-through mt-1">47 232 750 ₽</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border p-6 flex gap-3">
          <Link href={`/apartment/${apartment.id}`} className="flex-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-full bg-brand text-white px-6 py-3 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 btn-enhanced"
            >
              Открыть полную информацию
            </motion.button>
          </Link>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-full ring-1 ring-border bg-surface hover:bg-background transition-colors"
          >
            Закрыть
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}
