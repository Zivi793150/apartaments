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
      <section className="mt-12 md:mt-16" id="master">
        <div className="container-xl">
          <Reveal delay={0.1}>
            <motion.h2 
              className="text-3xl md:text-4xl mb-3 font-bold text-center md:text-left"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>
                Выбор на фасаде
              </span>
            </motion.h2>
          </Reveal>
          <Reveal delay={0.15}>
            <motion.p 
              className="text-muted mb-8 md:mb-10 text-center md:text-left max-w-2xl text-lg font-semibold"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Корпус. Этаж. Квартира. Быстро и красиво.
            </motion.p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="relative">
              <EstateBrowser3D />
            </div>
          </Reveal>
        </div>
      </section>
      <Gallery />
      <section id="about" className="container-xl mt-20 md:mt-28">
        <Reveal delay={0.1}>
          <motion.h2 
            className="text-3xl md:text-4xl mb-8 md:mb-12 font-bold text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>
              О проекте
            </span>
          </motion.h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Плавные анимации", desc: "Премиальные переходы и тактильные эффекты.", icon: "✨" },
            { title: "Интерактивные планы", desc: "2D/3D и быстрый предпросмотр.", icon: "🏗️" },
            { title: "Мобильный UX", desc: "Красиво, просто, удобно.", icon: "📱" },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <motion.div 
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-2xl bg-gradient-to-br from-surface/80 to-surface/50 backdrop-blur-sm p-6 md:p-8 ring-1 ring-border/60 hover:ring-border/80 transition-all duration-300 hover:shadow-2xl card-hover"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{item.title}</h3>
                <p className="text-muted text-[15px] leading-relaxed font-semibold">{item.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}


