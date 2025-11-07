"use client";
import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function FloorPlan2D({ building, floor, view = "2d" as "2d"|"3d" }: { building: string; floor: number; view?: "2d"|"3d" }) {
  // Унифицированный резолвер путей в public/plans с гибкими форматами
  const candidates = useMemo(() => {
    const b = (building || "").toString().toLowerCase();
    const f = floor.toString();
    const v = view.toLowerCase();
    // Популярные соглашения об именовании
    const bases = [
      `/plans/${b}/floor-${f}-${v}`,
      `/plans/${b}/${f}-${v}`,
      `/plans/${b}/${f}_${v}`,
      `/plans/${b}/${v}-${f}`,
      `/plans/${b}/${f}`,
      `/plans/floor-${f}-${v}`,
      `/plans/floor-${f}`,
    ];
    const exts = [".webp", ".jpg", ".jpeg", ".png"];
    const list: string[] = [];
    bases.forEach(base => exts.forEach(ext => list.push(`${base}${ext}`)));
    // Финальные фоллбеки
    list.push(view === "3d" ? "/images/plan-3d-2.jpg" : "/images/arch-1.jpg");
    return list;
  }, [building, floor, view]);

  const [srcIndex, setSrcIndex] = useState(0);
  const imageSrc = candidates[srcIndex] ?? candidates[candidates.length - 1];

  const handleError = useCallback(() => {
    setSrcIndex(i => Math.min(i + 1, candidates.length - 1));
  }, [candidates.length]);

  // Простая демонстрационная раскладка кликабельных квартир
  const apartments = useMemo(() => Array.from({ length: 6 }).map((_, i) => ({
    id: `${building}-${floor}-${i+1}`,
    // проценты относительно блока
    x: 6 + (i % 3) * 31.5,
    y: 8 + Math.floor(i / 3) * 42,
    w: 28,
    h: 36,
    label: `Кв. ${i+1} • 43.1 м²`,
  })), [building, floor]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl bg-surface shadow-lg ring-1 ring-border p-3 md:p-6"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-lg font-medium">Корпус {building.toUpperCase()} · {floor} этаж</h3>
        <Link href={`/building/${building}`} className="text-sm text-muted link-accent hover:text-foreground transition-colors">К выбору этажа</Link>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-border">
        <div className="relative w-full h-0 pb-[45%]">
          <Image src={imageSrc} alt="План этажа" fill className="object-cover transition-transform duration-500" sizes="100vw" onError={handleError} />
        </div>
        {/* Overlay hit boxes */}
        {apartments.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Link
              href={`/apartment/${a.id}`}
              className="absolute rounded-lg ring-1 ring-brand/40 hover:ring-brand bg-background/10 hover:bg-brand/10 transition-all duration-300 group"
              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}
            >
              <span className="absolute left-2 top-2 text-[12px] text-foreground/80 bg-background/80 backdrop-blur rounded-md px-2 py-1 font-medium group-hover:bg-brand group-hover:text-white transition-colors duration-300 shadow-sm">
                {a.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
