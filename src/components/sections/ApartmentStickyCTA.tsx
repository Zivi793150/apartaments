"use client";
import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function ApartmentStickyCTA({ id }: { id: string }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      className="fixed left-0 right-0 bottom-0 z-40 px-2 md:px-4 pb-2 md:pb-4"
    >
      <div className="mx-auto max-w-[1200px]">
        <motion.div 
          className="rounded-full md:rounded-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border/80 shadow-2xl flex items-center gap-2 md:gap-3 p-2 md:p-3"
          whileHover={{ scale: 1.01 }}
        >
          <div className="text-xs md:text-sm text-muted font-bold px-2 md:px-3 truncate">
            {id}
          </div>
          <motion.a
            href="#master"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 inline-flex items-center justify-center rounded-full bg-gradient-brand text-white px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 btn-enhanced"
          >
            К фасаду
          </motion.a>
        </motion.div>
      </div>
    </motion.div>
  );
}
