export type MapboxPickedUnit = { id: string; area: number; rooms: number } | null;

export type MapboxSceneFilter = {
  activeBuilding: "all" | "a" | "b";
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

export type Unit = {
  id: string;
  floor: number;
  status: "available" | "reserved" | "sold";
  area: number;
  rooms: number;
  polyUV: [number, number][];
};

export type BalconyProperties = {
  floor?: number;
  base?: number;
  height?: number;
  id?: string | number;
  type?: string;
};

export type AxisBasis = {
  center: [number, number];
  axes: [[number, number], [number, number]];
  spreads: [number, number];
};

export type UnitsTransform = {
  source: AxisBasis;
  target: AxisBasis;
  scales: [number, number];
};
