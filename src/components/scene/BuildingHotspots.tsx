"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, ArrowRight, Sparkles } from "lucide-react";

type Hotspot = {
  id: string;
  position: { x: number; y: number }; // screen coordinates 0-100%
  building: "a" | "b";
  floor: number;
  unit?: string;
  label: string;
  hint?: string;
};

const hotspots: Hotspot[] = [
  { id: "a-1", position: { x: 32, y: 65 }, building: "a", floor: 1, label: "Корпус A", hint: "Наведите курсор на квартиру" },
  { id: "a-2", position: { x: 35, y: 55 }, building: "a", floor: 2, label: "Этаж 2", hint: "Доступны 2-3 комнатные" },
  { id: "a-3", position: { x: 38, y: 45 }, building: "a", floor: 4, label: "Этаж 4", hint: "Вид на парк" },
  { id: "b-1", position: { x: 68, y: 65 }, building: "b", floor: 1, label: "Корпус B", hint: "Выберите квартиру" },
  { id: "b-2", position: { x: 65, y: 55 }, building: "b", floor: 3, label: "Этаж 3", hint: "Панорамные окна" },
];

export default function BuildingHotspots({ 
  activeBuilding, 
  onHotspotClick,
  visible = true 
}: { 
  activeBuilding: "all" | "a" | "b"; 
  onHotspotClick?: (hotspot: Hotspot) => void;
  visible?: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowHints(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const filteredHotspots = hotspots.filter(
    (h) => activeBuilding === "all" || activeBuilding === h.building
  );

  if (!visible || filteredHotspots.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <AnimatePresence>
        {filteredHotspots.map((hotspot, index) => {
          const isHovered = hoveredId === hotspot.id;
          const shouldShow = showHints || isHovered;

          return (
            <motion.div
              key={hotspot.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: shouldShow ? 1 : 0, scale: shouldShow ? 1 : 0.8 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="absolute pointer-events-auto"
              style={{
                left: `${hotspot.position.x}%`,
                top: `${hotspot.position.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseEnter={() => setHoveredId(hotspot.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onHotspotClick?.(hotspot)}
            >
              {/* Pulsing ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${
                    hotspot.building === "a" ? "#C47C57" : "#87919C"
                  }40 0%, transparent 70%)`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.7, 0, 0.7],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Second pulse ring for depth */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${
                    hotspot.building === "a" ? "#C47C57" : "#87919C"
                  }30 0%, transparent 70%)`,
                }}
                animate={{
                  scale: [1, 1.8, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              />

              {/* Main hotspot button */}
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className={`relative flex items-center justify-center w-12 h-12 rounded-full bg-background/95 backdrop-blur-md ring-2 shadow-lg transition-all duration-300 ${
                  hotspot.building === "a" ? "ring-[#C47C57]" : "ring-[#87919C]"
                }`}
              >
                <Home
                  className="w-5 h-5"
                  style={{
                    color: hotspot.building === "a" ? "#C47C57" : "#87919C",
                  }}
                />

                {/* Sparkle effect */}
                {isHovered && (
                  <motion.div
                    className="absolute -top-1 -right-1"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                  >
                    <Sparkles className="w-4 h-4 text-brand" />
                  </motion.div>
                )}
              </motion.button>

              {/* Tooltip on hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 whitespace-nowrap"
                  >
                    <div className="relative rounded-xl bg-background/95 backdrop-blur-md ring-1 ring-border shadow-xl px-4 py-2.5">
                      <div className="text-sm font-medium text-foreground">
                        {hotspot.label}
                      </div>
                      {hotspot.hint && (
                        <div className="text-xs text-muted mt-0.5">
                          {hotspot.hint}
                        </div>
                      )}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-background rotate-45 ring-l ring-t border-l border-t border-border" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Help text */}
      {showHints && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        >
          <div className="rounded-full bg-background/90 backdrop-blur-md ring-1 ring-border px-4 py-2 text-xs text-muted flex items-center gap-2 shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            Наведите курсор на квартиру для просмотра деталей
          </div>
        </motion.div>
      )}
    </div>
  );
}
