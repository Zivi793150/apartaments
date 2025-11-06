"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import SmoothScroll from "@/components/ux/SmoothScroll";
import RippleGrid from "@/components/ux/RippleGrid";

const Header = dynamic(() => import("@/components/layout/Header"), {
  ssr: false,
});

const Footer = dynamic(() => import("@/components/layout/Footer"), {
  ssr: false,
  loading: () => (
    <footer className="mt-32 border-t border-border/60 bg-gradient-to-b from-surface/80 to-background/40">
      <div className="container-xl py-12 md:py-16">
        <div className="h-32 bg-surface/20 animate-pulse rounded" />
      </div>
    </footer>
  ),
});

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      {/* На мобильных - простой статический фон, на ПК - менее интенсивный RippleGrid */}
      {isMobile ? (
        <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-br from-background via-surface/30 to-background" 
          style={{
            background: `
              radial-gradient(60% 60% at 80% 10%, rgba(224, 112, 62, 0.03), transparent 65%),
              radial-gradient(50% 50% at 10% 80%, rgba(245, 196, 173, 0.02), transparent 60%),
              var(--background)
            `
          }}
        />
      ) : (
        <RippleGrid 
          gridColor="#D7C6BB" 
          opacity={0.15} 
          rippleIntensity={0.015} 
          gridSize={14} 
          gridThickness={8} 
          fadeDistance={2.3} 
          vignetteStrength={1.5} 
          mouseInteraction={true} 
          mouseInteractionRadius={0.5} 
        />
      )}
      <SmoothScroll />
      <Header />
      {children}
      <Footer />
    </>
  );
}


