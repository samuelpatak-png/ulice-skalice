// Post-processing: N8AO ambient occlusion (replaces the render pass) -> HDR bloom -> ACES tone mapping +
// sRGB (OutputPass) -> filmic grade in display space -> SMAA / FXAA.  All intermediate targets are
// HalfFloat.  Bloom threshold is expressed in *exposed* units so only emissives and HDR highlights
// (sun glare, lamps, lit windows, headlights) bloom at any exposure.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { N8AOPass } from 'n8ao';
import { S, Q } from '../core/state.js';

const lerp = (a, b, t) => a + (b - a) * t;

// display-space grade: gentle S-curve, split toning (cool shadows / warm highlights), saturation,
// vignette, fine animated grain (also dithers the 8-bit output against sky banding)
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uContrast: { value: 0.14 },
    uSat: { value: 1.08 },
    uShadowTint: { value: new THREE.Vector3(-0.010, 0.002, 0.016) },
    uHighTint: { value: new THREE.Vector3(0.018, 0.006, -0.014) },
    uVignette: { value: 0.22 },
    uGrain: { value: 0.018 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uContrast, uSat, uVignette, uGrain;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = clamp(tex.rgb, 0.0, 1.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);                     // S-curve
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += uShadowTint * (1.0 - l) * (1.0 - l) + uHighTint * l * l;        // split toning
      c = mix(vec3(l), c, uSat);                                            // saturation
      vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float d = length(p) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5);
      c *= 1.0 - uVignette * smoothstep(0.35, 1.0, d);                      // vignette
      float n = hash(vUv * uRes + fract(uTime * 7.31) * 813.0) + hash(vUv * uRes * 1.37 + fract(uTime * 3.7) * 311.0) - 1.0;
      c += n * uGrain * (1.0 - 0.6 * l);                                    // grain (triangular noise)
      gl_FragColor = vec4(max(c, 0.0), tex.a);
    }`,
};

export function initPost(renderer, scene, camera) {
  const size = new THREE.Vector2();
  const POST = {
    composer: null, enabled: true, ao: null, bloom: null, output: null, grade: null, aa: null,
    stats: { ms: 0 },
    render, setSize, setQuality,
  };
  let time = 0;

  function pixelRatio() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return Math.min(dpr, 1.5) * Q().pixelRatio;
  }

  function dispose() {
    if (!POST.composer) return;
    for (const p of POST.composer.passes) p.dispose && p.dispose();
    POST.composer.dispose();
    POST.composer = null;
  }

  function build() {
    dispose();
    const q = Q();
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.getSize(size);
    const w = Math.max(1, Math.floor(size.x * pr)), h = Math.max(1, Math.floor(size.y * pr));
    const composer = new EffectComposer(renderer);   // HalfFloat ping-pong targets
    composer.setPixelRatio(pr);
    composer.setSize(size.x, size.y);

    if (q.ao) {
      const ao = new N8AOPass(scene, camera, w, h);
      const c = ao.configuration;
      c.gammaCorrection = false;        // OutputPass follows
      c.aoRadius = 3.0;                 // metres
      c.distanceFalloff = 1.0;
      c.intensity = 2.4;
      c.denoiseRadius = 12;
      c.halfRes = S.quality !== 'high';
      c.aoSamples = S.quality === 'high' ? 16 : 12;
      c.denoiseSamples = S.quality === 'high' ? 8 : 4;
      c.depthAwareUpsampling = true;
      composer.addPass(ao);
      POST.ao = ao;
    } else {
      composer.addPass(new RenderPass(scene, camera));
      POST.ao = null;
    }
    if (q.bloom) {
      POST.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.45, 2.0);
      POST.bloom.highPassUniforms.smoothWidth.value = 0.6;
      composer.addPass(POST.bloom);
    } else POST.bloom = null;
    POST.output = new OutputPass();
    composer.addPass(POST.output);
    POST.grade = new ShaderPass(GradeShader);
    composer.addPass(POST.grade);
    POST.aa = q.aa === 'smaa' ? new SMAAPass() : new FXAAPass();
    composer.addPass(POST.aa);
    composer.setSize(size.x, size.y);   // propagate to all passes (N8AO, bloom, AA)
    POST.grade.uniforms.uRes.value.set(w, h);
    POST.composer = composer;
  }

  function render(dt = 1 / 60) {
    const t0 = performance.now();
    if (!POST.enabled || !POST.composer) { renderer.render(scene, camera); POST.stats.ms = performance.now() - t0; return; }
    time += dt;
    const n = S.night, expo = renderer.toneMappingExposure || 1;
    if (POST.bloom) {
      // threshold in exposed units (ACES input x = v * exposure / 0.6): ~0.9 display by day, ~0.75 at night
      const x = lerp(2.3, 1.15, n);
      POST.bloom.threshold = x * 0.6 / expo;
      POST.bloom.strength = lerp(0.14, 0.34, n);
      POST.bloom.radius = lerp(0.3, 0.42, n);
    }
    const g = POST.grade.uniforms;
    g.uTime.value = time;
    g.uContrast.value = lerp(0.14, 0.18, n);
    g.uSat.value = lerp(1.08, 1.12, n);
    g.uShadowTint.value.set(lerp(-0.010, -0.014, n), lerp(0.002, 0.004, n), lerp(0.016, 0.028, n));
    g.uHighTint.value.set(lerp(0.018, 0.022, n), lerp(0.006, 0.008, n), lerp(-0.014, -0.02, n));
    g.uVignette.value = lerp(0.22, 0.3, n);
    POST.composer.render(dt);
    POST.stats.ms = performance.now() - t0;
  }

  function setSize(w, h) {
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    if (!POST.composer) return;
    POST.composer.setPixelRatio(pr);
    POST.composer.setSize(w, h);
    POST.grade.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
  }

  function setQuality(qname) {
    if (qname && qname !== S.quality) S.quality = qname;
    build();
  }

  build();
  return POST;
}
