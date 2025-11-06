"use client";
import dynamic from "next/dynamic";
import Gallery from "@/components/sections/Gallery";
import Reveal from "@/components/ux/Reveal";
import EstateBrowser3D from "@/components/scene/EstateBrowser3D";
import FavoritesBar from "@/components/sections/FavoritesBar";
import { motion } from "framer-motion";

const Hero = dynamic(() => import("@/components/hero/Hero"), {
  ssr: false,
  loading: () => (
    <section className="container-xl grid gap-8 md:gap-10 md:grid-cols-2 md:items-center mt-8 md:mt-14">
      <div className="space-y-6 text-center md:text-left">
        <div className="h-4 w-32 bg-surface rounded animate-pulse" />
        <div className="h-16 w-full bg-surface rounded animate-pulse" />
        <div className="h-6 w-full bg-surface rounded animate-pulse" />
      </div>
      <div className="h-[420px] md:h-[560px] w-full rounded-2xl bg-surface animate-pulse" />
    </section>
  ),
});

export default function HomeClient() {
  return (
    <>
      <FavoritesBar />
      <Hero />
      {/* Полноширинный 3D Browser 360 в центрированном окне */}
      <section className="mt-8 md:mt-12">
        <div className="container-xl">
          <Reveal delay={0.1}>
            <h2 className="text-2xl md:text-3xl mb-2 font-medium text-center md:text-left bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>Выбор на фасаде</h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-muted mb-6 text-center md:text-left max-w-2xl">Корпус. Этаж. Квартира. Быстро и красиво.</p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="relative">
              <EstateBrowser3D />
            </div>
          </Reveal>
        </div>
      </section>
      <Gallery />
      <section id="about" className="container-xl mt-24 md:mt-32 grid gap-6 md:grid-cols-3">
        {[
          { title: "Плавные анимации", desc: "Премиальные переходы и тактильные эффекты." },
          { title: "Интерактивные планы", desc: "2D/3D и быстрый предпросмотр." },
          { title: "Мобильный UX", desc: "Красиво, просто, удобно." },
        ].map((item, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <motion.div 
              whileHover={{ y: -8, scale: 1.03, rotateY: 2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-2xl bg-gradient-to-br from-surface/90 to-white backdrop-blur-md p-6 md:p-8 ring-1 ring-border/80 hover:ring-brand/30 transition-all duration-300 hover:shadow-2xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              <h3 className="text-lg font-bold mb-3 text-foreground">{item.title}</h3>
              <p className="text-muted text-[15px] leading-relaxed font-semibold">{item.desc}</p>
            </motion.div>
          </Reveal>
        ))}
      </section>
    </>
  );
}


