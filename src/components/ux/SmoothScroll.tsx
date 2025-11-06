"use client";
import Lenis from "lenis";
import { useEffect } from "react";

export default function SmoothScroll() {
  useEffect(() => {
const lenis = new Lenis({ duration: 0.8, easing: (t: number) => t });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => { lenis.destroy(); };
  }, []);
  return null;
}
