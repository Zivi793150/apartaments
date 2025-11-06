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
    <motion.section className="container-xl mt-20" id="plans" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ amount: 0.2, once: true }}>
      <h2 className="text-2xl md:text-3xl mb-6 font-medium">Визуализации</h2>
      <div className="grid gap-4 md:grid-cols-3 auto-rows-[200px]">
        {images.map((img, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ amount: 0.4, once: true }}
            transition={{ duration: 0.65, ease: [0.22,0.61,0.36,1], delay: i * 0.09 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className={`relative overflow-hidden rounded-2xl bg-surface ring-1 ring-border cursor-pointer group ${i===0?"md:row-span-2":""}`}
            onClick={() => setSelectedImage(i)}
          >
            <Image src={img.src} alt={img.alt} fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="(min-width: 768px) 33vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
