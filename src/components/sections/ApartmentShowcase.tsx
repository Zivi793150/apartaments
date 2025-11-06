"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import React, { useRef } from "react";

export default function ApartmentShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 0.95]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -12]);

  return (
    <section ref={ref} className="mt-10 md:mt-24 mb-8 md:mb-12">
      <div className="container-xl">
        {/* Блок 1: Большая типографика + овал */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            className="px-1"
          >
            <motion.div 
              style={{ y: titleY }} 
              className="text-[clamp(28px,4.4vw,48px)] leading-tight font-display font-bold"
            >
              Окна с низкими <br />
              подоконными зонами
            </motion.div>
            <p className="mt-4 text-muted max-w-md font-semibold">
              Высокие оконные проёмы обеспечивают естественный свет в течение всего дня
              и создают ощущение пространства.
            </p>
          </motion.div>
          <motion.div 
            style={{ y, scale }} 
            className="relative aspect-[4/3] md:aspect-[3/2] card-hover"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="absolute inset-0 rounded-[50%] overflow-hidden">
              <Image src="/images/arch-2.jpg" alt="Интерьер" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
            </div>
          </motion.div>
        </div>

        {/* Блок 2: Флип карточки с маской-раскрытием */}
        <div className="mt-10 md:mt-24 grid md:grid-cols-2 gap-6 md:gap-10 items-center">
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
            whileInView={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            className="relative rounded-3xl overflow-hidden ring-1 ring-border min-h-[240px]"
          >
            <Image src="/images/arch-1.jpg" alt="Балконы" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
          </motion.div>
          <motion.div
            initial={{ rotateY: 12, opacity: 0.0, translateZ: 0 }}
            whileInView={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            className="[transform-style:preserve-3d]"
          >
            <div className="text-[clamp(24px,4vw,40px)] font-display leading-tight font-bold">
              Тёплые лоджии и приватные террасы
            </div>
            <p className="mt-3 text-muted max-w-[46ch] font-semibold">
              Пространства, в которых приятно проводить вечер: мягкий свет, вид на море и приватность.
            </p>
          </motion.div>
        </div>

        {/* Блок 3 */}
        <div className="mt-10 md:mt-12 grid md:grid-cols-2 gap-6">
          {[{
            title: "Шумоизоляция и современные конвекторы",
            text: "Комфорт в любое время года и тишина внутри квартиры.",
            img: "/images/arch-3.jpg",
          }, {
            title: "Кладовые в подземном паркинге",
            text: "Дополнительное пространство для хранения рядом с автомобилем.",
            img: "/images/arch-1.jpg",
          }].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ duration: 0.6, delay: i * 0.12, type: "spring", stiffness: 300 }}
              viewport={{ once: true, margin: "-80px" }}
              className="rounded-3xl bg-white ring-1 ring-border overflow-hidden card-hover"
            >
              <div className="grid grid-cols-5">
                <div className="col-span-3 p-6 pr-4">
                  <div className="text-[clamp(18px,2.6vw,28px)] leading-snug font-display font-bold">{card.title}</div>
                  <p className="mt-3 text-muted text-[15px] leading-relaxed font-semibold">{card.text}</p>
                </div>
                <div className="col-span-2 relative min-h-[180px] md:min-h-[220px]">
                  <Image src={card.img} alt={card.title} fill className="object-cover" sizes="(max-width:768px) 50vw, 30vw" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
