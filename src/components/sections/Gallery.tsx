"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { X } from "lucide-react";

const images = [
  { src: "/images/plan-3d-1.jpg", alt: "3D план 1" },
  { src: "/images/plan-3d-2.jpg", alt: "3D план 2" },
  { src: "/images/arch-1.jpg", alt: "Фасад 1" },
  { src: "/images/arch-2.jpg", alt: "Фасад 2" },
  { src: "/images/arch-3.jpg", alt: "Фасад 3" },
];

export default function Gallery() {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  return (
    <motion.section 
      className="container-xl mt-20 md:mt-28" 
      id="plans" 
      initial={{ opacity: 0 }} 
      whileInView={{ opacity: 1 }} 
      viewport={{ amount: 0.2, once: true }}
    >
      <motion.h2 
        className="text-3xl md:text-4xl mb-8 md:mb-12 font-bold"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>
          Визуализации
        </span>
      </motion.h2>
      <div className="grid gap-4 md:gap-6 md:grid-cols-3 auto-rows-[200px] md:auto-rows-[240px]">
        {images.map((img, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ amount: 0.3, once: true }}
            transition={{ duration: 0.7, ease: [0.22,0.61,0.36,1], delay: i * 0.1 }}
            whileHover={{ scale: 1.03, y: -6 }}
            whileTap={{ scale: 0.98 }}
            className={`relative overflow-hidden rounded-2xl md:rounded-3xl bg-surface ring-1 ring-border/60 hover:ring-border cursor-pointer group shadow-lg hover:shadow-2xl transition-all duration-500 ${i===0?"md:row-span-2":""}`}
            onClick={() => setSelectedImage(i)}
          >
            <Image 
              src={img.src} 
              alt={img.alt} 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-110" 
              sizes="(min-width: 768px) 33vw, 100vw" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
              <p className="text-white font-semibold text-sm md:text-base">{img.alt}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Fullscreen image viewer */}
      {selectedImage !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X className="w-6 h-6" />
          </motion.button>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative w-full h-full max-w-7xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selectedImage].src}
              alt={images[selectedImage].alt}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </motion.div>
        </motion.div>
      )}
    </motion.section>
  );
}
