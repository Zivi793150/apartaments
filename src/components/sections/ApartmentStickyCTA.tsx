"use client";
import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function ApartmentStickyCTA({ id }: { id: string }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      className="fixed left-0 right-0 bottom-0 z-40"
    >
      <div className="mx-auto max-w-[1200px] px-3 pb-3">
        <div className="rounded-full bg-background/90 backdrop-blur-md ring-1 ring-border shadow-2xl flex items-center gap-3 p-2">
          <div className="text-sm text-muted hidden md:block font-medium">Квартира {id}</div>
          <motion.a
            href={`/apartment/${id}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 inline-flex items-center justify-center rounded-full bg-brand text-white px-5 py-2.5 text-sm shadow-md hover:shadow-lg transition-all duration-300 btn-enhanced"
          >
            Открыть план
          </motion.a>
          <motion.a
            href="#master"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-full ring-1 ring-border text-sm hidden md:inline-flex hover:bg-surface transition-colors"
          >
            К фасаду
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
}
