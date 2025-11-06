"use client";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-32 border-t border-border/60 bg-gradient-to-b from-surface/80 to-background/40">
      <div className="container-xl py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-3 mb-8">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="flex items-center gap-2 mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <Building2 className="w-5 h-5 text-brand" />
              <span className="text-[18px] md:text-[20px] font-display font-bold">
                La <span className="text-brand font-bold">Srmonia</span> Costerra
              </span>
            </motion.div>
            <p className="text-sm md:text-base text-muted leading-relaxed font-semibold">
              Премиальные жилые комплексы с инновационными решениями и современным дизайном.
            </p>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 300 }}
          >
            <h3 className="text-sm md:text-base font-bold mb-4 md:mb-6 text-foreground">Навигация</h3>
            <nav className="flex flex-col gap-3 md:gap-4 text-sm md:text-base">
              {[
                { href: "#master", label: "План квартала" },
                { href: "#plans", label: "Планы этажей" },
                { href: "#about", label: "О проекте" },
              ].map((item, idx) => (
                <motion.a 
                  key={item.href}
                  href={item.href}
                  className="link-accent text-muted hover:text-foreground transition-colors font-semibold"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + idx * 0.05 }}
                  whileHover={{ x: 4 }}
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>
          </motion.div>

          {/* Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 300 }}
          >
            <h3 className="text-sm md:text-base font-bold mb-4 md:mb-6 text-foreground">Контакты</h3>
            <div className="flex flex-col gap-3 md:gap-4 text-sm md:text-base">
              <motion.a 
                href="tel:+74954324768" 
                className="flex items-center gap-2 hover:text-brand transition-colors font-semibold text-muted"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Phone className="w-4 h-4 md:w-5 md:h-5" />
                +7 (495) 432-47-68
              </motion.a>
              <motion.a 
                href="mailto:info@example.com" 
                className="flex items-center gap-2 hover:text-brand transition-colors font-semibold text-muted"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Mail className="w-4 h-4 md:w-5 md:h-5" />
                info@example.com
              </motion.a>
              <motion.div 
                className="flex items-start gap-2 font-semibold text-muted"
                whileHover={{ x: 4 }}
              >
                <MapPin className="w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0" />
                <span>Москва, ул. Примерная, д. 1</span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-8 border-t border-border/40 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-muted"
        >
          <p>© {currentYear} Девелопер. Все права защищены.</p>
          <div className="flex gap-6">
            <a className="link-accent hover:text-foreground transition-colors" href="#privacy">
              Политика конфиденциальности
            </a>
            <a className="link-accent hover:text-foreground transition-colors" href="#contacts">
              Контакты
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
