"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut, Move } from "lucide-react";
import Image from "next/image";

type TourImage = {
  src: string;
  alt: string;
  yaw?: number; // horizontal rotation angle in degrees
};

type ApartmentTour360Props = {
  images: TourImage[];
  isOpen: boolean;
  onClose: () => void;
  initialImageIndex?: number;
};

export default function ApartmentTour360({
  images,
  isOpen,
  onClose,
  initialImageIndex = 0,
}: ApartmentTour360Props) {
  const [currentIndex, setCurrentIndex] = useState(initialImageIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const deltaX = e.touches[0].clientX - dragStart.x;
    const deltaY = e.touches[0].clientY - dragStart.y;
    
    // Horizontal drag changes image (360 rotation)
    if (Math.abs(deltaX) > 30) {
      const direction = deltaX > 0 ? -1 : 1;
      setCurrentIndex((prev) => {
        const next = prev + direction;
        return Math.max(0, Math.min(images.length - 1, next));
      });
      setIsDragging(false);
    } else {
      // Vertical drag for panning
      setOffset((prev) => ({
        x: prev.x,
        y: prev.y + deltaY * 0.5,
      }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    if (Math.abs(deltaX) > 50) {
      const direction = deltaX > 0 ? -1 : 1;
      setCurrentIndex((prev) => {
        const next = prev + direction;
        return Math.max(0, Math.min(images.length - 1, next));
      });
      setIsDragging(false);
    } else {
      setOffset((prev) => ({
        x: prev.x + deltaX * 0.3,
        y: prev.y + deltaY * 0.3,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, images.length, onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialImageIndex);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isOpen, initialImageIndex]);

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const resetView = () => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur-md ring-1 ring-border shadow-lg flex items-center justify-center hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </motion.button>

          {/* Controls bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background/90 backdrop-blur-md rounded-full px-4 py-2 ring-1 ring-border shadow-lg">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </motion.button>
            
            <div className="w-px h-6 bg-border" />
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </motion.button>
            
            <div className="w-px h-6 bg-border" />
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={resetView}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Image viewer */}
          <div
            ref={imageRef}
            className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)",
                }}
              >
                <div className="relative w-full h-full max-w-7xl">
                  <Image
                    src={images[currentIndex]?.src || "/images/arch-1.jpg"}
                    alt={images[currentIndex]?.alt || "3D Tour"}
                    fill
                    className="object-contain"
                    priority
                    sizes="100vw"
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            {images.map((_, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex
                    ? "bg-brand w-8"
                    : "bg-border hover:bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation arrows */}
          {currentIndex > 0 && (
            <motion.button
              whileHover={{ scale: 1.1, x: -4 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-background/90 backdrop-blur-md ring-1 ring-border shadow-lg flex items-center justify-center hover:bg-surface transition-colors"
            >
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
          )}
          
          {currentIndex < images.length - 1 && (
            <motion.button
              whileHover={{ scale: 1.1, x: 4 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-background/90 backdrop-blur-md ring-1 ring-border shadow-lg flex items-center justify-center hover:bg-surface transition-colors"
            >
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          )}

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 text-center"
          >
            <div className="bg-background/90 backdrop-blur-md rounded-full px-4 py-2 ring-1 ring-border shadow-lg text-xs text-muted flex items-center gap-2">
              <Move className="w-3.5 h-3.5" />
              Перетащите для поворота • Используйте стрелки для навигации
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
