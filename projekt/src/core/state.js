// Global runtime state shared by all modules (single source of truth, no hidden globals elsewhere).
import * as THREE from 'three';

export const S = {
  base: '',                       // URL prefix for runtime files (assets/, data/). Tests set '/public/'.
  renderer: null,
  scene: null,
  camera: null,
  time: 0,                        // seconds since the game started (monotonic, pauses with the game)
  tod: 0.40,                      // time of day 0..1 (0 = midnight, 0.25 = 6:00, 0.5 = noon, 0.75 = 18:00)
  night: 0,                       // 0 = full daylight .. 1 = full night (drives emissive lights, street lamps, windows)
  sunDir: new THREE.Vector3(0.5, 0.7, 0.3).normalize(),   // unit vector pointing TOWARDS the sun (or moon at night)
  wind: 0.5,                      // 0..1 wind strength (vegetation sway)
  wet: 0,                         // 0..1 wet roads
  quality: 'high',                // 'low' | 'medium' | 'high'
  mobile: false,
  paused: false,
};

export const QUALITY = {
  low:    { pixelRatio: 0.75, shadowMap: 1024, shadowDist: 70,  ao: false, bloom: true,  aa: 'fxaa', drawDist: 900,  trees: 0.55, traffic: 14, peds: 14, texSize: 512 },
  medium: { pixelRatio: 1.0,  shadowMap: 2048, shadowDist: 110, ao: true,  bloom: true,  aa: 'smaa', drawDist: 1400, trees: 0.8,  traffic: 22, peds: 22, texSize: 1024 },
  high:   { pixelRatio: 1.0,  shadowMap: 4096, shadowDist: 150, ao: true,  bloom: true,  aa: 'smaa', drawDist: 2200, trees: 1.0,  traffic: 30, peds: 32, texSize: 1024 },
};
export const Q = () => QUALITY[S.quality];
