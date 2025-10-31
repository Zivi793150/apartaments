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
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-brand" />
              <span className="text-[18px] font-display">
                La <span className="text-brand">Srmonia</span> Costerra
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Премиальные жилые комплексы с инновационными решениями и современным дизайном.
            </p>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h3 className="text-sm font-medium mb-4 text-foreground">Навигация</h3>
            <nav className="flex flex-col gap-3 text-sm">
              <a className="link-accent text-muted hover:text-foreground transition-colors" href="#master">
                План квартала
              </a>
              <a className="link-accent text-muted hover:text-foreground transition-colors" href="#plans">
                Планы этажей
              </a>
              <a className="link-accent text-muted hover:text-foreground transition-colors" href="#about">
                О проекте
              </a>
            </nav>
          </motion.div>

          {/* Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h3 className="text-sm font-medium mb-4 text-foreground">Контакты</h3>
            <div className="flex flex-col gap-3 text-sm text-muted">
              <a href="tel:+74954324768" className="flex items-center gap-2 hover:text-brand transition-colors">
                <Phone className="w-4 h-4" />
                +7 (495) 432-47-68
              </a>
              <a href="mailto:info@example.com" className="flex items-center gap-2 hover:text-brand transition-colors">
                <Mail className="w-4 h-4" />
                info@example.com
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Москва, ул. Примерная, д. 1</span>
              </div>
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
