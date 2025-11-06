"use client";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const FLOORS = 3;
const UNITS_PER_FLOOR = 4;

export default function BuildingScene({ onSelectApartment }: { onSelectApartment?: (id: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  // Детерминированные данные для SSR/CSR一致ности
  const units = useMemo(() => {
    return Array.from({ length: FLOORS * UNITS_PER_FLOOR }).map((_, idx) => {
      const floor = FLOORS - Math.floor(idx / UNITS_PER_FLOOR);
      const number = (idx % UNITS_PER_FLOOR) + 1;
      // Площадь детерминирована формулой (без Math.random)
      const area = 36 + (number * 2.5) + (floor * 0.8);
      const status = (idx % 7 === 0 ? "booked" : "available");
      return {
        id: `A-${floor}-${number}`,
        floor,
        unit: number,
        area: Number(area.toFixed(1)),
        rooms: 1 + (number % 2),
        status,
        x: 12 + (number - 1) * 20.7,
        y: 11 + (FLOORS - floor) * 17.5,
        w: 17.1,
        h: 15.7,
      };
    });
  }, []);

  const unit = hovered ? units.find((u) => u.id === hovered) : undefined;

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none">
      <div className="rounded-xl bg-surface shadow-lg aspect-[16/11] relative overflow-visible">
        {units.map((ap) => (
          <div
            key={ap.id}
            className={`absolute cursor-pointer transition-all border-2 group
              ${ap.status==="available" ? "border-brand/50" : "border-muted/50 opacity-70"}
              ${hovered===ap.id ? "z-30 shadow-2xl" : "z-10 shadow-sm"}
            `}
            style={{
              left: `${ap.x}%`,
              top: `${ap.y}%`,
              width: `${ap.w}%`,
              height: `${ap.h}%`,
              background:
                hovered===ap.id ? "var(--brand)" : ap.status!=="available" ? "var(--muted)" : "var(--color-accent-satin)",
              opacity: hovered===ap.id ? 0.96 : 0.86
            }}
            onMouseEnter={() => setHovered(ap.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              setSelected(ap.id);
              setTimeout(() => {
                router.push(`/apartment/${ap.id}`);
              }, 120);
              if (onSelectApartment) onSelectApartment(ap.id);
            }}
          >
            <span className="absolute left-1 top-1 text-xs px-2 py-0.5 rounded bg-background/70 font-semibold">
              {ap.id}
            </span>
            <span className="absolute right-1 bottom-1 text-[11px] px-2 py-0.5 rounded bg-background/50 text-muted">
              {ap.area} м²
            </span>
          </div>
        ))}
        <AnimatePresence>
          {unit && (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 14, scale:0.98 }}
              animate={{ opacity: 1, y: 0, scale:1 }}
              exit={{ opacity: 0, y: 16, scale:0.95 }}
              transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
              className="pointer-events-none absolute z-50 hidden md:block"
              style={{
                left: `calc(${unit.x + unit.w * 0.5}% - 80px)`,
                top: `calc(${unit.y}% - 56px)`
              }}
            >
              <div className="w-[177px] p-3 rounded-2xl bg-surface ring-1 ring-border shadow-xl backdrop-blur">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`inline-block size-2 rounded-full ${unit.status==="available" ? "bg-brand" : "bg-muted"}`} />
                  <span className="text-xs font-medium text-muted">Этаж {unit.floor}</span>
                </div>
                <div className="text-base font-medium text-brand mb-0.5">{unit.area} м²</div>
                <div className="text-[13px] text-muted">Комнат: <b className="text-foreground">{unit.rooms}</b></div>
                <div className="text-[13px] text-muted mt-1 italic mb-2">{unit.status === "available" ? "В продаже" : "Забронирована"}</div>
                <button
                  className="w-full rounded-full bg-brand text-white px-2.5 py-1 text-sm hover:bg-brand/90 transition shadow-sm"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => router.push(`/apartment/${unit.id}`)}
                >Смотреть квартиру</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {unit && (
            <motion.div
              key={unit.id + "-mobile"}
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 120 }}
              transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
              className="md:hidden fixed left-0 right-0 bottom-0 z-50 px-3 pb-2"
            >
              <div className="w-full max-w-lg mx-auto rounded-2xl bg-surface/95 ring-1 ring-border shadow-2xl backdrop-blur p-5 flex flex-col gap-2">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`inline-block size-2 rounded-full ${unit.status==="available" ? "bg-brand" : "bg-muted"}`} />
                  <span className="text-xs font-medium text-muted">Этаж {unit.floor}</span>
                  <span className="ml-auto text-xs opacity-60">{unit.id}</span>
                </div>
                <div className="text-base font-medium text-brand mb-0.5">{unit.area} м²</div>
                <div className="text-[13px] text-muted">Комнат: <b className="text-foreground">{unit.rooms}</b></div>
                <div className="text-[13px] text-muted mt-1 italic mb-2">{unit.status === "available" ? "В продаже" : "Забронирована"}</div>
                <button
                  className="mt-1 w-full rounded-full bg-brand text-white px-2.5 py-2 text-lg hover:bg-brand/90 active:scale-95 transition shadow-md font-medium"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => router.push(`/apartment/${unit.id}`)}
                >Смотреть квартиру</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
