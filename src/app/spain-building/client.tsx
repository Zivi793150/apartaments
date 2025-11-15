"use client";

import { useState } from "react";
import type { Spain3DPickedUnit, Spain3DSceneFilter } from "@/components/scene/SpainBuilding3D";
import SpainBuilding3D from "@/components/scene/SpainBuilding3D";
import { motion } from "framer-motion";
import { Heart, ChevronRight } from "lucide-react";

export default function BuildingSpainClient() {
  const [selectedApt, setSelectedApt] = useState<Spain3DPickedUnit>(null);
  const [filter, setFilter] = useState<Spain3DSceneFilter>({});
  const [favorites, setFavorites] = useState<string[]>([]);

  const handleApartmentPick = (apt: Spain3DPickedUnit) => {
    setSelectedApt(apt);
  };

  const toggleFavorite = (aptId: string) => {
    setFavorites((prev: string[]) =>
      prev.includes(aptId)
        ? prev.filter((id: string) => id !== aptId)
        : [...prev, aptId]
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pt-8 pb-16 px-4">
      {/* Заголовок */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Премиум квартиры в Испании
          </h1>
          <p className="text-lg text-slate-300">
            Алгарробо • Испания • Просмотр через Mapbox 3D с реальным окружением
          </p>
        </div>
      </motion.div>

      {/* Основная сцена */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <SpainBuilding3D
          onPick={handleApartmentPick}
          filter={filter}
          showInfo={true}
        />
      </motion.div>

      {/* Фильтры и информация */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Фильтры */}
          <div className="md:col-span-1">
            <motion.div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 ring-1 ring-white/10">
              <h2 className="text-white font-bold text-lg mb-4">Фильтры</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Количество комнат
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((rooms) => (
                      <motion.button
                        key={rooms}
                        onClick={() =>
                          setFilter((p) => ({
                            ...p,
                            rooms: p.rooms === rooms ? null : (rooms as any),
                          }))
                        }
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                          filter.rooms === rooms
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                            : "bg-white/10 text-slate-300 hover:bg-white/20"
                        }`}
                      >
                        {rooms}к
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.onlyAvailable || false}
                      onChange={(e) =>
                        setFilter((p) => ({
                          ...p,
                          onlyAvailable: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded-lg bg-white/20 border-white/30 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-slate-300">
                      Только свободные
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-500 text-center">
                    🔄 Карта автоматически вращается 360°
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Информация и легенда */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Легенда статусов */}
            <motion.div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 ring-1 ring-white/10">
              <h3 className="text-white font-bold text-lg mb-4">Легенда</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#4fea98]" />
                  <span className="text-sm text-slate-300">Свободная квартира</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#ffcd3c]" />
                  <span className="text-sm text-slate-300">Зарезервирована</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#b8b8b8]" />
                  <span className="text-sm text-slate-300">Продана</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#FF6A2B]" />
                  <span className="text-sm text-slate-300">Выбранная</span>
                </div>
              </div>
            </motion.div>

            {/* Информация об объекте */}
            <motion.div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 ring-1 ring-white/10">
              <h3 className="text-white font-bold text-lg mb-4">Об объекте</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Этажей:</span>
                  <span className="font-semibold text-white">6</span>
                </div>
                <div className="flex justify-between">
                  <span>Квартир на этаж:</span>
                  <span className="font-semibold text-white">4</span>
                </div>
                <div className="flex justify-between">
                  <span>Итого квартир:</span>
                  <span className="font-semibold text-white">24</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-white/10">
                  <span>Высота этажа:</span>
                  <span className="font-semibold text-white">3.2м</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Выбранная квартира */}
        {selectedApt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent backdrop-blur-md rounded-2xl p-8 ring-1 ring-orange-500/20"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Квартира {selectedApt.id}
                </h3>
                <p className="text-slate-300 mb-4">
                  {selectedApt.rooms}-комнатная • {selectedApt.area} м² • Этаж {selectedApt.floor}
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleFavorite(selectedApt.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    favorites.includes(selectedApt.id)
                      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
                      : "bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                >
                  <Heart
                    size={18}
                    fill={favorites.includes(selectedApt.id) ? "currentColor" : "none"}
                  />
                  В избранное
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold"
                >
                  <ChevronRight size={18} />
                  Подробнее
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
