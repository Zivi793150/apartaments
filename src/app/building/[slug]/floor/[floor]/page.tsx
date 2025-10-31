"use client";
import FloorPlan2D from "@/components/floor/FloorPlan2D";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ViewMode = "2d" | "3d";

export default function FloorPage() {
  const { slug: rawSlug, floor: rawFloor } = useParams<{ slug?: string; floor?: string }>();
  const slug = (rawSlug ?? "a").toString();
  const floor = Number((rawFloor ?? "1").toString());
  const [view, setView] = useState<ViewMode>("2d");
  const floors = useMemo(() => Array.from({ length: 6 }, (_, i) => i + 1), []);
  const currentIdx = Math.max(0, floors.indexOf(floor));
  const prev = floors[Math.max(0, currentIdx - 1)];
  const next = floors[Math.min(floors.length - 1, currentIdx + 1)];

  return (
    <main className="container-xl pb-24 mt-10">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl md:text-3xl font-medium"
        >
          Этаж {floor}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href={`/building/${slug}`} className="text-sm text-muted link-accent hover:text-foreground transition-colors">К корпусу {slug.toUpperCase()}</Link>
        </motion.div>
      </div>

      {/* Mobile quick floor navigation */}
      <div className="md:hidden flex items-center justify-between mb-3">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link href={`/building/${slug}/floor/${prev}`} className="inline-flex items-center gap-1 rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-border hover:bg-background transition-colors">
            <ChevronLeft className="w-4 h-4" />
            {prev}
          </Link>
        </motion.div>
        <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border">
          {["2d","3d"].map((v) => (
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
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link href={`/building/${slug}/floor/${next}`} className="inline-flex items-center gap-1 rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-border hover:bg-background transition-colors">
            {next}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <FloorPlan2D building={slug} floor={floor} view={view} />
      </motion.div>
    </main>
  );
}
