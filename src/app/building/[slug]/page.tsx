"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import BuildingScene3D from "@/components/scene/BuildingScene3D";

type ViewMode = "2d" | "3d";

export default function BuildingPage() {
  const { slug: rawSlug } = useParams<{ slug?: string }>();
  const slug = (rawSlug ?? "a").toString();
  const floors = useMemo(() => Array.from({ length: 6 }, (_, i) => 6 - i), []);
  const [view, setView] = useState<ViewMode>("3d");
  const [activeFloor, setActiveFloor] = useState<number>(6);
  const touchStartY = useRef<number | null>(null);

  const facadeImg = "/images/arch-1.jpg";
  const view3dImg = "/images/plan-3d-2.jpg";

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(delta) > 36) {
      setActiveFloor((prev) => {
        const idx = floors.indexOf(prev);
        const nextIdx = delta > 0 ? Math.min(idx + 1, floors.length - 1) : Math.max(idx - 1, 0);
        return floors[nextIdx];
      });
      touchStartY.current = e.touches[0].clientY;
    }
  };
  const handleTouchEnd = () => { touchStartY.current = null; };

  return (
    <main className="container-xl pb-24 mt-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-medium">Корпус {slug.toUpperCase()}</h1>
        <Link href="/" className="text-sm text-muted link-accent">На главную</Link>
      </div>

      <div className="grid md:grid-cols-[280px,1fr] gap-8">
        {/* Sidebar (desktop) */}
        <aside className="rounded-2xl bg-white ring-1 ring-border p-6 hidden md:block">
          <p className="text-sm text-muted mb-4">Быстрый доступ</p>
          <ol className="grid grid-cols-5 gap-2">
            {floors.map((f) => (
              <li key={f}>
                <motion.button
                  onClick={() => setActiveFloor(f)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-full rounded-lg text-center py-2.5 transition-all duration-300 font-medium ${activeFloor===f?"bg-brand text-white shadow-md":"bg-surface hover:bg-background ring-1 ring-border"}`}
                >
                  {f}
                </motion.button>
              </li>
            ))}
          </ol>
          <div className="mt-4 text-xs text-muted">{slug.toLowerCase()==="a"?"С паркингом":"Без паркинга"}</div>
        </aside>

        {/* Main viewer */}
        <section className="rounded-2xl bg-white ring-1 ring-border p-3 md:p-6 min-h-64">
          <div className="flex items-center justify-between mb-3 md:mb-4 px-2 md:px-0">
            <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border">
              {["3d","2d"].map((v) => (
                <motion.button
                  key={v}
                  onClick={() => setView(v as ViewMode)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 text-sm rounded-full transition-all duration-300 ${view===v?"bg-brand text-white shadow-md":"text-muted hover:text-foreground"}`}
                >
                  {v.toUpperCase()}
                </motion.button>
              ))}
            </div>
            <div className="text-xs text-muted">{slug.toLowerCase()==="a"?"Паркинг: есть":"Паркинг: нет"}</div>
          </div>

          {view === "3d" ? (
            <BuildingScene3D />
          ) : (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0.0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.995 }}
                  transition={{ duration: 0.5, ease: [0.22,0.61,0.36,1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={view === "2d" ? facadeImg : view3dImg}
                    alt={view === "2d" ? "Фасад, 2D" : "Перспектива, 3D"}
                    fill
                    priority
                    className="object-cover"
                    sizes="100vw"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
