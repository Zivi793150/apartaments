"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

export default function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center","end start"] });
  const yParallax = useTransform(scrollYProgress, [0,1], [0,-60]);
  const imgScale = useTransform(scrollYProgress, [0,1], [1, 0.96]);
  const imgOpacity = useTransform(scrollYProgress, [0,1], [1, 0.85]);
  return (
    <section ref={ref} className="container-xl grid gap-8 md:gap-10 md:grid-cols-2 md:items-center mt-8 md:mt-14">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22,0.61,0.36,1] }}
        className="space-y-6 text-center md:text-left"
      >
        <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-muted">Бизнес‑класс</p>
        <h1 className="text-[clamp(32px,6.2vw,68px)] leading-[1.04]">
          Дома, в которые <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>хочется</span> вернуться
        </h1>
        <p className="text-[16px] md:text-lg text-muted max-w-xl mx-auto md:mx-0 leading-relaxed">
          Выберите корпус и этаж. Остальное — почувствуете.
        </p>
        <div className="flex gap-3 justify-center md:justify-start">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="/building/a">
              <Button size="lg" className="btn-enhanced" style={{ backgroundImage: 'var(--gradient-brand)' }}>Выбрать корпус</Button>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="#plans">
              <Button size="lg" variant="outline" className="hover:bg-surface transition-colors">Планы этажей</Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22,0.61,0.36,1], delay: 0.1 }}
        style={{ y: yParallax, scale: imgScale, opacity: imgOpacity }}
        className="h-[420px] md:h-[560px] w-full rounded-2xl overflow-hidden bg-surface mx-auto"
      >
        <div className="relative h-full w-full">
          <Image src="/images/arch-1.jpg" alt="AUREO" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          <div className="absolute inset-0 bg-gradient-to-tr from-background/30 via-transparent to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
