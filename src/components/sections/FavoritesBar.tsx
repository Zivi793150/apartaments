"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, GitCompare, ExternalLink } from "lucide-react";
import Link from "next/link";

export type FavoriteApartment = {
  id: string;
  area: number;
  rooms: number;
  price?: number;
};

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteApartment[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("favorite_apartments");
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  const addFavorite = (apt: FavoriteApartment) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === apt.id);
      if (exists) return prev;
      const next = [...prev, apt];
      localStorage.setItem("favorite_apartments", JSON.stringify(next));
      return next;
    });
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem("favorite_apartments", JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  return { favorites, addFavorite, removeFavorite, isFavorite };
}

export default function FavoritesBar() {
  const { favorites, removeFavorite } = useFavorites();
  const [isOpen, setIsOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  if (favorites.length === 0) {
    // Always render trigger button, but hidden when empty
    return (
      <motion.button
        data-favorites-trigger
        initial={false}
        className="hidden"
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <>
      <motion.button
        data-favorites-trigger
        initial={false}
        onClick={() => setIsOpen(!isOpen)}
        className="hidden"
      />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-20 md:bottom-24 right-4 z-50"
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-full bg-brand text-white p-3 shadow-2xl ring-4 ring-background/50"
          title="Избранное"
        >
          <Heart className="w-5 h-5 fill-current" />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-foreground text-background text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
          >
            {favorites.length}
          </motion.span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-4 bottom-32 md:bottom-36 w-[min(90vw,380px)] bg-background/95 backdrop-blur-md rounded-2xl shadow-2xl ring-1 ring-border z-50 p-4 max-h-[60vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Избранное ({favorites.length})</h3>
                <div className="flex gap-2">
                  {favorites.length >= 2 && (
                    <motion.button
                      onClick={() => setShowCompare(true)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-lg bg-surface hover:bg-background ring-1 ring-border transition-colors"
                    >
                      <GitCompare className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => setIsOpen(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg bg-surface hover:bg-background ring-1 ring-border transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              <div className="space-y-2">
                {favorites.map((apt, i) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface ring-1 ring-border hover:shadow-md transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{apt.id}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {apt.area} м² · {apt.rooms}к
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Link href={`/apartment/${apt.id}`}>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1.5 rounded-lg bg-brand/10 hover:bg-brand text-brand hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </motion.div>
                      </Link>
                      <motion.button
                        onClick={() => removeFavorite(apt.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompare && favorites.length >= 2 && (
          <CompareModal
            apartments={favorites}
            onClose={() => setShowCompare(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CompareModal({
  apartments,
  onClose,
}: {
  apartments: FavoriteApartment[];
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-foreground/60 backdrop-blur-md z-[60]"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(90vw,900px)] max-h-[90vh] bg-background rounded-3xl shadow-2xl ring-1 ring-border z-[70] p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-medium">Сравнение квартир</h2>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg hover:bg-surface ring-1 ring-border transition-colors"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {apartments.map((apt, i) => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-surface ring-1 ring-border p-5"
            >
              <div className="text-xl font-medium mb-3">{apt.id}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Площадь</span>
                  <span className="font-medium">{apt.area} м²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Комнат</span>
                  <span className="font-medium">{apt.rooms}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Корпус</span>
                  <span className="font-medium">{apt.id.split("-")[0]}</span>
                </div>
              </div>
              <Link href={`/apartment/${apt.id}`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-4 w-full rounded-full bg-brand text-white px-4 py-2 text-sm font-medium btn-enhanced"
                >
                  Открыть план
                </motion.button>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </>
  );
}

