"use client";
import { motion } from "framer-motion";

const regions = [
  { name: "Андалусия", subtitle: "Малага, Севилья", note: "Туризм, растущие цены, высокий спрос.", tag: "Рост + Доход от аренды" },
  { name: "Валенсия", subtitle: "Валенсийское сообщество", note: "Популярность растёт, цены ещё доступны.", tag: "Потенциал роста" },
  { name: "Каталония", subtitle: "Барселона и окрестности", note: "Устойчивый рост, но возможна волатильность.", tag: "Ликвидность" },
  { name: "Мадрид", subtitle: "Столица", note: "Стабильность, сильный спрос на жильё и коммерцию.", tag: "Стабильность" },
  { name: "Балеары", subtitle: "Пальма‑де‑Майорка и др.", note: "Премиум, высокий спрос в турсезон.", tag: "Премиум + Туризм" },
];

export default function InvestmentRegions() {
  return (
    <section className="mt-16 md:mt-24">
      <div className="container-xl">
        <div className="overflow-hidden mb-6 relative">
          <div className="whitespace-nowrap text-[clamp(28px,6.5vw,80px)] font-display tracking-tight text-foreground/25">
            ИНВЕСТИЦИОННАЯ КАРТА • ИСПАНИЯ • РЕГИОНЫ • ТРЕНДЫ • СПРОС •
          </div>
        </div>
        <div className="grid gap-6">
          {regions.map((r, idx) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="relative rounded-3xl ring-1 ring-border bg-white dark:bg-background/80 backdrop-blur px-4 py-5 md:px-6 md:py-6 hover:shadow-lg transition-all duration-300"
              whileHover={{ y: -2, scale: 1.01 }}
            >
              <div className="md:flex md:items-center md:justify-between gap-6">
                <div>
                  <div className="text-[clamp(22px,3.5vw,36px)] font-display leading-tight">{r.name}</div>
                  <div className="text-muted text-[14px] md:text-[15px] mt-1">{r.subtitle} — {r.note}</div>
                </div>
                <div className="mt-3 md:mt-0">
                  <span className="inline-block px-3 py-1.5 rounded-full bg-brand/10 text-brand ring-1 ring-brand/20 text-[12px] font-medium">{r.tag}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
