"use client";
import * as React from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";

export type PickedUnit = { id: string; area: number; rooms: number } | null;

import { useRouter } from "next/navigation";

type BuildingKind = "a" | "b";

const FLOORS = 6;
const UNITS_PER_FLOOR = 4;

function getUnitColor(kind: BuildingKind, available: boolean, hovered: boolean) {
  if (!available) return "#7a8794";
  if (hovered) return getBrand(kind);
  return getAccent(kind);
}

function getBrand(kind: BuildingKind) { return kind === "a" ? "#C47C57" : "#87919C"; }
function getAccent(kind: BuildingKind) { return kind === "a" ? "#d7b3a0" : "#c8cdd4"; }

function generateUnits(kind: BuildingKind) {
  const units: Array<{ id: string; floor: number; col: number; area: number; rooms: number; available: boolean }> = [];
  for (let f = 1; f <= FLOORS; f++) {
    for (let c = 1; c <= UNITS_PER_FLOOR; c++) {
      const id = `${kind.toUpperCase()}-${f}-${c}`;
      const area = 36 + (c * 2.5) + (f * 0.9);
      const rooms = 1 + (c % 3 === 0 ? 2 : (c % 2));
      const available = (f * c) % 5 !== 0;
      units.push({ id, floor: f, col: c, area: Number(area.toFixed(1)), rooms, available });
    }
  }
  return units;
}

function NeonGlow({ size = [0.98, 0.58, 0.22], color = "#C47C57" as string }) {
  return (
    <mesh>
      <boxGeometry args={size as any} />
      <meshBasicMaterial color={color} transparent opacity={0.42} blending={2} />
    </mesh>
  );
}

function ApartmentBox({
  kind,
  unit,
  position,
  dimmed,
  onHover,
  onPick,
}: {
  kind: BuildingKind;
  unit: { id: string; floor: number; col: number; area: number; rooms: number; available: boolean };
  position: [number, number, number];
  dimmed: boolean;
  onHover: (u: any | null, worldPos?: Vector3) => void;
  onPick: (u: any, worldPos?: Vector3) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const color = getUnitColor(kind, unit.available, hovered);
  const opacity = dimmed ? 0.25 : hovered ? 0.98 : 0.86;
  const ref = React.useRef<any>(null);
  return (
    <group position={position} ref={ref}>
      {hovered && !dimmed && <NeonGlow color={getBrand(kind)} />}
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); onHover(unit, ref.current?.getWorldPosition(new Vector3())); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); if (!dimmed) onPick(unit, ref.current?.getWorldPosition(new Vector3())); }}
      >
        <boxGeometry args={[0.9, 0.5, 0.2]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.55} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, -0.22, 0.12]}>
        <boxGeometry args={[0.95, 0.08, 0.18]} />
        <meshStandardMaterial color="#dcdfe4" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Building({ kind, offsetX, withParking, filter, onHoverUnit, onPickUnit }: { kind: BuildingKind; offsetX: number; withParking: boolean; filter: SceneFilter; onHoverUnit: (u: any | null, world?: Vector3) => void; onPickUnit: (u: any, world?: Vector3) => void }) {
  const units = React.useMemo(() => generateUnits(kind), [kind]);
  const width = UNITS_PER_FLOOR * 1.1 + 0.6;
  const height = FLOORS * 0.7 + 0.6;
  const isActive = (filter.activeBuilding === kind);

  return (
    <group position={[offsetX, 0, 0]}>
      {/* subtle active highlight */}
      {isActive && (
        <mesh position={[0, 0, -0.05]} rotation={[0,0,0]}>
          <planeGeometry args={[width+0.4, height+0.4]} />
          <meshBasicMaterial color={kind === "a" ? "#C47C57" : "#87919C"} transparent opacity={0.08} />
        </mesh>
      )}
      <mesh position={[0, height/2 - 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.4]} />
        <meshStandardMaterial color={kind === "a" ? "#F3F1EE" : "#EAECEF"} roughness={0.9} metalness={0.02} />
      </mesh>
      {Array.from({ length: UNITS_PER_FLOOR * 2 + 1 }).map((_, i) => (
        <mesh key={`v-${i}`} position={[(-width/2) + i*(width/(UNITS_PER_FLOOR*2)), 0, 0.205]}>
          <boxGeometry args={[0.01, height, 0.01]} />
          <meshStandardMaterial color="#c3c9cf" roughness={0.85} />
        </mesh>
      ))}
      {Array.from({ length: FLOORS * 2 + 1 }).map((_, j) => (
        <mesh key={`h-${j}`} position={[0, (-height/2) + j*(height/(FLOORS*2)), 0.205]}>
          <boxGeometry args={[width, 0.01, 0.01]} />
          <meshStandardMaterial color="#d0d5db" roughness={0.85} />
        </mesh>
      ))}

      {units.map((u) => {
        const x = (-width/2) + 0.8 + (u.col-1) * 1.1;
        const y = (-height/2) + 0.55 + (u.floor-1) * 0.7;
        const matches = (
          (filter.activeBuilding === "all" || filter.activeBuilding === kind) &&
          (!filter.onlyAvailable || u.available) &&
          (!filter.rooms || u.rooms === filter.rooms) &&
          (!filter.hoverFloor || u.floor === filter.hoverFloor)
        );
        return (
          <ApartmentBox key={u.id} kind={kind} unit={u} position={[x, y, 0.31]} dimmed={!matches} onHover={onHoverUnit} onPick={onPickUnit} />
        );
      })}
    </group>
  );
}

export type SceneFilter = {
  activeBuilding: "all" | BuildingKind;
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

function ProjectorInside({ hovered, onProject }: { hovered: any | null; onProject: (pt: {x:number;y:number}|null) => void }) {
  const { size, camera } = useThree();
  React.useEffect(() => {
    if (hovered && hovered.worldPosition instanceof Vector3) {
      const v = hovered.worldPosition.clone().project(camera);
      const x = (v.x + 1) / 2 * size.width;
      const y = (-v.y + 1) / 2 * size.height;
      onProject({ x, y });
    } else {
      onProject(null);
    }
  }, [hovered, size, camera, onProject]);
  return null;
}

export default function BuildingScene3D({ filter, onPick }: { filter: SceneFilter; onPick?: (u: PickedUnit) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState<any | null>(null);
  const [screenPos, setScreenPos] = React.useState<{x:number;y:number}|null>(null);
  const [pulse, setPulse] = React.useState<{x:number;y:number}|null>(null);
  const [vh, setVh] = React.useState<number>(68);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [showMobileHint, setShowMobileHint] = React.useState<boolean>(false);
  React.useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth < 768);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  React.useEffect(() => {
    if (isMobile) {
      setShowMobileHint(true);
      const t = setTimeout(() => setShowMobileHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [isMobile]);

  // smooth focus to active building (A/B/All)
  const targetXRef = React.useRef<number>(0);
  React.useEffect(() => {
    // центры зданий соответствуют offsetX для левого/правого корпусов
    if (filter.activeBuilding === "a") targetXRef.current = -3.6;
    else if (filter.activeBuilding === "b") targetXRef.current = 3.6;
    else targetXRef.current = 0; // центр
  }, [filter.activeBuilding]);

  // Drag handle for mobile to resize scene height
  const dragRef = React.useRef<{startY:number;startVh:number}|null>(null);
  const onTouchStart = (e: React.TouchEvent) => { dragRef.current = { startY: e.touches[0].clientY, startVh: vh }; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.touches[0].clientY; // up increases
    const next = Math.max(50, Math.min(90, dragRef.current.startVh + dy / 6));
    setVh(next);
  };
  const onTouchEnd = () => { dragRef.current = null; };

  return (
    <div ref={containerRef} className="relative w-full max-w-[980px] md:max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface px-3 md:px-0" style={{ overscrollBehavior: "contain", height: `${vh}vh` }} onWheelCapture={(e) => { e.preventDefault(); }}>
      {/* Parking badges */}
      <div className="absolute left-4 bottom-4 z-10 hidden md:block">
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-[12px] ring-1 ring-border/60 shadow-lg"
        >
          Корпус A · Паркинг
        </motion.div>
      </div>
      <div className="absolute right-4 bottom-4 z-10 hidden md:block">
        <motion.div 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-[12px] ring-1 ring-border/60 shadow-lg"
        >
          Корпус B · Без паркинга
        </motion.div>
      </div>
      
      {/* Mobile helper hint - moved to bottom, dismissible */}
      {isMobile && showMobileHint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className="absolute left-3 right-3 bottom-16 z-20 md:hidden"
        >
          <div className="bg-background/95 backdrop-blur-md rounded-full px-3 py-2 text-[12px] text-muted ring-1 ring-border/60 shadow-lg flex items-center gap-2">
            <span>💡 Потяните вниз, чтобы увеличить область просмотра</span>
            <button onClick={() => setShowMobileHint(false)} className="ml-auto text-xs px-2 py-0.5 rounded bg-surface ring-1 ring-border hover:bg-surface/80">OK</button>
          </div>
        </motion.div>
      )}

      {/* Hover overlay card */}
      {hovered && screenPos && (
        <div className="pointer-events-none absolute z-20" style={{ left: screenPos.x - 90, top: screenPos.y - 120 }}>
          <div className="rounded-2xl bg-background/95 backdrop-blur ring-1 ring-border shadow-xl px-3 py-2 w-[180px]">
            <div className="text-[12px] text-muted mb-0.5">Этаж {hovered.floor}</div>
            <div className="text-[16px] font-medium">
              {hovered.id}
              <span className={`ml-2 inline-block size-2 rounded-full align-middle ${hovered.available?"bg-brand":"bg-muted"}`} />
            </div>
            <div className="text-[12px] text-muted">{hovered.area} м² · {hovered.rooms}к</div>
          </div>
        </div>
      )}

      {/* Click pulse feedback */}
      {pulse && (
        <div className="pointer-events-none absolute z-20" style={{ left: pulse.x - 10, top: pulse.y - 10 }}>
          <div className="size-5 rounded-full bg-brand/60 animate-ping" />
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: isMobile ? [6.2, 5.2, 10.5] as any : [7.2, 5.2, 11.5] as any, fov: isMobile ? 42 : 36 }}
        dpr={[1, 2]}
        onPointerMissed={() => { setHovered(null); }}
      >
        {/* camera remains fixed; no auto-zoom/pan */}
        <color attach="background" args={[0,0,0]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 6, 6]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#ece7e2" roughness={0.95} />
        </mesh>
        <Building kind="a" withParking offsetX={-3.6} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        <Building kind="b" withParking={false} offsetX={3.6} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        <ProjectorInside hovered={hovered} onProject={(pt)=>setScreenPos(pt)} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          zoomSpeed={0}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI/2.2}
          minDistance={5}
          maxDistance={14}
        />
      </Canvas>

      {/* Mobile drag handle */}
      {isMobile && (
        <motion.div 
          className="absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center pb-2" 
          onTouchStart={onTouchStart} 
          onTouchMove={onTouchMove} 
          onTouchEnd={onTouchEnd}
          whileTap={{ scale: 0.95 }}
        >
          <div className="h-8 w-32 rounded-full bg-background/85 backdrop-blur-md ring-1 ring-border/60 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="h-1.5 w-16 rounded-full bg-border/70" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
