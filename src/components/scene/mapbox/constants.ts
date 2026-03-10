import type * as GeoJSON from "geojson";

export const TOTAL_FLOORS = 6;
export const FLOOR_HEIGHT_M = 3.1;

export const FLOOR_SCALE_OVERRIDES: Record<number, number> = {
  4: 0.015,
  5: 0.025,
  6: 0.035,
};

export const emptyFeatureCollection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const UNITS_OUTLINE_STRIP_SCALE = -0.008;
export const UNITS_OUTLINE_OUTSET = 0.0015;
export const UNITS_OUTLINE_Z_EPS = 0.01;
export const UNITS_OUTLINE_BAND_HEIGHT = 0.045;
export const UNITS_OUTLINE_VERT_POST_MULT = 0.15;
export const UNITS_OUTLINE_VERT_INSET_MULT = 0.65;
export const UNITS_OUTLINE_VERT_POST_MIN_SIZE = 0.0000004;
export const UNITS_OUTLINE_COLOR = "#2b2420";
export const UNITS_OUTLINE_OPACITY = 1;

export const BUILDING_BASE_COLOR = "#f6f6f6";
export const BALCONY_FLOOR_COLOR = "#f0ece7";
export const TERRACE_FLOOR_COLOR = "#eee8e1";
export const TERRACE_GLASS_COLOR = "#d9e5f1";
export const TERRACE_GLASS_OPACITY = 0.55;
export const BALCONY_GLASS_COLOR = "#dfe9f4";
export const BALCONY_GLASS_OPACITY = 0.65;
export const FACADE_GLASS_COLOR = "#c6d8eb";
export const FACADE_GLASS_OPACITY = 0.78;

export const STREET_WALL_STRIP_SCALE = -0.02;

export const TERRACE_FLOOR_THICKNESS = 0.12;
export const TERRACE_RAIL_HEIGHT = FLOOR_HEIGHT_M / 3;
export const TERRACE_RAIL_SCALE = -0.06;

export const BALCONY_FLOOR_THICKNESS = 0.1;
export const BALCONY_RAIL_HEIGHT = FLOOR_HEIGHT_M * 0.48;
export const BALCONY_RAIL_SCALE = -0.03;
export const BALCONY_POST_SIZE_FACTOR = 0.0025;
export const BALCONY_POST_MIN_SIZE = 0.000002;

export const STREET_BEAM_SIZE_FACTOR = 0.042;
export const STREET_BEAM_MIN_SIZE = 0.0000025;
export const STREET_TOP_BEAM_HEIGHT = 0.22;
export const STREET_TOP_BEAM_THICKNESS_FACTOR = 1.35;
export const STREET_CROSS_DEPTH_FACTOR = 0.35;
export const STREET_CROSS_WIDTH_FACTOR = 0.22;
export const STREET_CROSS_WINDOW_INSET_FACTOR = 0.05;
export const STREET_CROSS_DEPTH_CLEARANCE_FACTOR = 0.35;

export const STREET_CROSS_HALF_HEIGHT = 0.08;
export const FLOOR5_LEFT_PANORAMA_BAND = 0.29;
export const FLOOR5_FRONT_RIGHT_BAND = 1 / 3;
export const FLOOR5_PERP_WINDOW_BAND = 1 / 3;
export const FLOOR5_FRONT_ASPECT_RATIO = 0.85;
export const FLOOR5_EDGE_BLEND = 0.04;
export const STREET_CORNER_BEAM_WIDTH_FACTOR = 0.08;
export const STREET_CORNER_BEAM_DEPTH_FACTOR = 0.12;
export const FLOOR5_RELAXED_FACING_COS = 0.4;
export const FLOOR5_SIDE_WINDOW_BAND = 1 / 3;
export const FLOOR5_FRONT_ALIGNMENT = 0.72;
export const FLOOR5_SIDE_ALIGNMENT = 0.6;
export const STREET_GLASS_TARGET_FLOORS = [5, 4, 3, 2];

export const BALCONY_FALLBACK: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export const TERRACE_FALLBACK: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const HOVER_EDGE_SCALE = 0.006;
export const HOVER_FACE_SCALE = -0.003;
export const HOVER_BASE_LIFT = 0.18;
