"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function FloorPlan2D({ building, floor, view = "2d" as "2d"|"3d" }: { building: string; floor: number; view?: "2d"|"3d" }) {
  const imageSrc = useMemo(() => {
    // По требованию используем arch-1 для 2D и plan-3d-2 для 3D
    if (view === "3d") return "/images/plan-3d-2.jpg";
    return "/images/arch-1.jpg";
  }, [view]);

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
      className="rounded-2xl bg-white shadow-lg ring-1 ring-border p-3 md:p-6"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-lg font-medium">Корпус {building.toUpperCase()} · {floor} этаж</h3>
        <Link href={`/building/${building}`} className="text-sm text-muted link-accent hover:text-foreground transition-colors">К выбору этажа</Link>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-border">
        <div className="relative w-full h-0 pb-[45%]">
          <Image src={imageSrc} alt="План этажа" fill className="object-cover transition-transform duration-500" sizes="100vw" />
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
