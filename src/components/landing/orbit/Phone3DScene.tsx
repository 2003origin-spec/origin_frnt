'use client';

/**
 * A real 3D phone showing the app's screens (three.js; loaded only where WebGL works).
 *
 * Model: a rounded metal body, the screenshot on a rounded glass screen (unlit, so the app's
 * colours stay true), a punch-hole camera, side buttons and a faint glare.
 * Procedural animation (springs and sines, no keyframe files):
 *   - entrance: turns in from the side and rises, once, when first seen;
 *   - idle: floats gently (no turning: it turns only toward the pointer);
 *   - pointer: tilts toward the pointer;
 *   - screens: when `active` changes, the new screen fades in over the old one.
 * Renders only while on screen; holds still under reduced motion.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useReducedMotion } from 'framer-motion';

const W = 1.0;
const H = 2.2;
const DEPTH = 0.11;
const SW = 0.93; // screen
const SH = 2.12;
const SR = 0.1;

function roundedRect(w: number, h: number, r: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 12);
  // Map UVs 0..1 over the rectangle, so a screenshot fills the screen exactly.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

type Props = {
  screens: string[];
  active?: number;
  /** Frame only the top of the phone (the hero); the page fades the rest out. */
  crop?: boolean;
  /** Play the turn-in entrance the first time it is drawn (off for phones mounted on scroll). */
  entrance?: boolean;
  onFail: () => void;
  className?: string;
};

export default function Phone3DScene({ screens, active = 0, crop = false, entrance = true, onFail, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const activeRef = useRef(active);
  const apiRef = useRef<{ show: (i: number) => void } | null>(null);
  // The scene is rebuilt only when the screenshots really change, not when a caller passes
  // an equal array again; changing `active` only crossfades the screen.
  const screensKey = screens.join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);
    // If the browser takes the context away (too many 3D scenes, GPU reset), show the flat version.
    const onLost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3fb8ff, 2.2);
    rim.position.set(4, 1, -3);
    scene.add(rim);

    const disposables: { dispose(): void }[] = [envTex, pmrem];
    const phone = new THREE.Group();
    scene.add(phone);

    const bodyGeo = new RoundedBoxGeometry(W, H, DEPTH, 6, 0.12);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b2036,
      metalness: 0.75,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    });
    phone.add(new THREE.Mesh(bodyGeo, bodyMat));
    disposables.push(bodyGeo, bodyMat);

    // Black glass around the screen
    const glassGeo = roundedRect(W - 0.03, H - 0.03, 0.11);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x05060f, roughness: 0.15, metalness: 0.1, clearcoat: 1 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = DEPTH / 2 + 0.001;
    phone.add(glass);
    disposables.push(glassGeo, glassMat);

    // Screens: one mesh per screenshot, stacked; the active one is opaque.
    const screenGeo = roundedRect(SW, SH, SR);
    disposables.push(screenGeo);
    const loader = new THREE.TextureLoader();
    const screenMats = screens.map((src, i) => {
      const tex = loader.load(src, () => wake());
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: i === activeRef.current ? 1 : 0, toneMapped: false });
      const mesh = new THREE.Mesh(screenGeo, mat);
      mesh.position.z = DEPTH / 2 + 0.002 + i * 0.0004;
      mesh.renderOrder = 1 + i;
      phone.add(mesh);
      disposables.push(tex, mat);
      return mat;
    });

    // Punch-hole camera
    const camHoleGeo = new THREE.CircleGeometry(0.022, 24);
    const camHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const camHole = new THREE.Mesh(camHoleGeo, camHoleMat);
    camHole.position.set(0, SH / 2 - 0.05, DEPTH / 2 + 0.006);
    camHole.renderOrder = 20;
    phone.add(camHole);
    disposables.push(camHoleGeo, camHoleMat);

    // Glare: a faint diagonal sheen across the glass
    const gc = document.createElement('canvas');
    gc.width = 64;
    gc.height = 128;
    const gctx = gc.getContext('2d')!;
    const grad = gctx.createLinearGradient(0, 0, 64, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.42, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 128);
    const glareTex = new THREE.CanvasTexture(gc);
    const glareMat = new THREE.MeshBasicMaterial({ map: glareTex, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
    const glare = new THREE.Mesh(screenGeo, glareMat);
    glare.position.z = DEPTH / 2 + 0.008;
    glare.renderOrder = 30;
    phone.add(glare);
    disposables.push(glareTex, glareMat);

    // Side buttons
    const btnGeo = new THREE.BoxGeometry(0.014, 0.17, 0.034);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x2a3048, metalness: 0.8, roughness: 0.3 });
    [0.5, 0.24].forEach((y, n) => {
      const b = new THREE.Mesh(btnGeo, btnMat);
      b.position.set(W / 2 + 0.004, y, 0);
      if (n === 1) b.scale.y = 0.55;
      phone.add(b);
    });
    disposables.push(btnGeo, btnMat);

    // ── layout ────────────────────────────────────────────────────────────
    const lookY = crop ? H / 2 - 0.62 : 0;
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      const fovV = THREE.MathUtils.degToRad(camera.fov);
      // Whole phone, or (crop) its top 1.45 units, plus room to tilt.
      // Narrow stages (phones) keep less margin so the phone fills the width and stays readable.
      const tight = camera.aspect < 0.7;
      const needH = crop ? 1.6 : H + (tight ? 0.22 : 0.35);
      const needW = W + (crop ? 0.3 : tight ? 0.16 : 0.55);
      const dist = Math.max(needH / 2 / Math.tan(fovV / 2), needW / 2 / (Math.tan(fovV / 2) * camera.aspect));
      camera.position.set(0, lookY, dist);
      camera.lookAt(0, lookY, 0);
      camera.updateProjectionMatrix();
      wake();
    };

    // ── motion ────────────────────────────────────────────────────────────
    const tilt = { x: 0, y: 0 };
    const tiltTarget = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      if (reduceMotion) return;
      const r = host.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 1);
      const py = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
      tiltTarget.y = THREE.MathUtils.clamp(px, -1, 1) * 0.35;
      tiltTarget.x = THREE.MathUtils.clamp(py, -1, 1) * 0.18;
      wake();
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const clock = new THREE.Clock(false);
    // Timed by the clock, not by frames, so slow devices finish on time too.
    let enterStart = -1;
    let raf = 0;
    let visible = false;
    let last = 0;
    let fade: { from: number; to: number; start: number } | null = null;
    let current = activeRef.current;

    apiRef.current = {
      show: (i: number) => {
        if (i === current || !screenMats[i]) return;
        if (reduceMotion) {
          screenMats.forEach((m, n) => (m.opacity = n === i ? 1 : 0));
          current = i;
        } else {
          fade = { from: current, to: i, start: clock.running ? clock.getElapsedTime() : 0 };
          current = i;
        }
        wake();
      },
    };

    function wake() {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function frame() {
      raf = 0;
      if (!clock.running) clock.start();
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, t - last || 0.016);
      last = t;
      // Entrance: ease-out over about 1.2 s
      if (enterStart < 0) enterStart = t;
      const entered = reduceMotion || !entrance ? 1 : Math.min(1, (t - enterStart) / 1.2);
      const e = 1 - Math.pow(1 - entered, 3);
      tilt.x += (tiltTarget.x - tilt.x) * (1 - Math.exp(-5 * dt));
      tilt.y += (tiltTarget.y - tilt.y) * (1 - Math.exp(-5 * dt));
      const float = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.03;
      phone.rotation.set(0.05 + tilt.x, -0.32 + tilt.y + (1 - e) * -1.1, 0.02);
      phone.position.y = float - (1 - e) * 0.5;
      if (fade) {
        const ft = Math.min(1, (t - fade.start) / 0.45);
        screenMats.forEach((m, n) => {
          // The new screen fades in over the old one, which stays put underneath.
          if (n === fade!.to) m.opacity = ft;
          else if (n === fade!.from) m.opacity = 1;
          else m.opacity = 0;
        });
        if (ft >= 1) {
          screenMats.forEach((m, n) => (m.opacity = n === fade!.to ? 1 : 0));
          fade = null;
        }
      }
      renderer.render(scene, camera);
      if (visible && !reduceMotion) raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(host);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      apiRef.current = null;
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      disposables.forEach((d) => d.dispose());
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- screensKey stands for screens
  }, [screensKey, crop, entrance, onFail, reduceMotion]);

  useEffect(() => {
    activeRef.current = active;
    apiRef.current?.show(active);
  }, [active]);

  return <div ref={hostRef} className={className} />;
}
