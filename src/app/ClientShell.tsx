"use client";
import dynamic from "next/dynamic";
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
  return (
    <>
      <RippleGrid gridColor="#D7C6BB" opacity={0.35} rippleIntensity={0.035} gridSize={14} gridThickness={10} fadeDistance={2.3} vignetteStrength={2.1} mouseInteraction={true} mouseInteractionRadius={0.7} />
      <SmoothScroll />
      <Header />
      {children}
      <Footer />
    </>
  );
}


