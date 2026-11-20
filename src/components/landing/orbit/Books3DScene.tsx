'use client';

/**
 * The book pile (three.js, ≥1024 px with WebGL). Books lie in a stack with their spines facing
 * the visitor. Procedural animation, springs only (no keyframe files):
 *   - hover: the book under the pointer slides out a little, like a finger pulling at it;
 *   - click: the book lifts out, turns upright to show its cover and floats beside the pile,
 *     while the books that were above it drop into the gap with a small bounce;
 *   - put back (click it again, or "Put it back" in the card): it arcs over and lands on top,
 *     so the pile reshuffles as the visitor plays.
 * Renders only while on screen; under reduced motion every move is instant.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';

import { putOnTop, takeFromPile, type Book } from './books-data';

const L = 2.0; // spine length (the cover's height)
const D = 1.5; // cover width
const THICK = [0.3, 0.34, 0.26, 0.36, 0.28, 0.31]; // a pile looks real when the books differ
const YAW = [0.05, -0.07, 0.03, -0.04, 0.08, -0.02];
const NUDGE = [0.04, -0.06, 0.02, 0.07, -0.03, 0.05];
const STACK_X = 1.05;
const SHOW_X = -1.15;
/** Where the open book stands: its spread (cover + page) is then centred on x = 0. */
const OPEN_X = 0.73;
/** How far the pile slides right to make room while a book is open (out of frame). */
const PILE_AWAY = 3.6;
const OPEN_ANGLE = 2.9; // the cover opens almost flat, like a real book (≈166°)
const LEAVES = 3; // paper leaves that riffle over after the cover
const COVER_TURN = 0.95; // seconds for the cover to turn
const LEAF_TURN = 0.7; // seconds for one leaf to turn
const LEAF_GAP = 0.2; // seconds between one sheet starting and the next
const SHEET_SEGS = 24; // bends along the page (spine → fore-edge)
const OPEN_AFTER = 0.9; // seconds after standing up

/** A portrait image (w×h) turned a quarter, so its top runs along the spine and its left
 *  edge is the spine: how a cover (or a page) sits on the box's top face. */
function quarterTurn(src: CanvasImageSource, w = 480, h = 640): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = h;
  c.height = w;
  const ctx = c.getContext('2d')!;
  ctx.translate(0, w);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Paper, drawn at 2× (960×1280) so its text stays sharp when the open book fills the stage. */
function paper(spineSide: 'left' | 'right'): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 1280;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, 480, 640);
  // A soft shade toward the spine
  const g = spineSide === 'left' ? ctx.createLinearGradient(0, 0, 70, 0) : ctx.createLinearGradient(480, 0, 410, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, 640);
  ctx.textBaseline = 'alphabetic';
  return { c, ctx };
}

/** The right-hand page: the book's worked question, printed like a textbook page. */
function pageCanvas(book: Book, fonts: { heading: string; body: string }): HTMLCanvasElement {
  const { c, ctx } = paper('left');
  const x = 46;
  const w = 480 - x - 34;
  let y = 58;
  ctx.fillStyle = book.color;
  ctx.font = `800 17px ${fonts.body}`;
  for (const l of wrap(ctx, book.worked.chapter.toUpperCase(), w)) {
    ctx.fillText(l, x, y);
    y += 22;
  }
  ctx.fillRect(x, y - 10, 52, 4);
  y += 34;

  ctx.fillStyle = '#0b1020';
  ctx.font = `800 31px ${fonts.heading}`;
  ctx.fillText('Worked example', x, y);
  y += 42;

  ctx.font = `700 23px ${fonts.body}`;
  for (const l of wrap(ctx, book.worked.question, w)) {
    ctx.fillText(l, x, y);
    y += 31;
  }
  y += 16;

  book.worked.steps.forEach((step, n) => {
    ctx.fillStyle = book.color;
    ctx.font = `800 22px ${fonts.body}`;
    ctx.fillText(`${n + 1}.`, x, y);
    ctx.fillStyle = '#20263f';
    ctx.font = `500 22px ${fonts.body}`;
    for (const l of wrap(ctx, step, w - 34)) {
      ctx.fillText(l, x + 34, y);
      y += 30;
    }
    y += 8;
  });
  y += 12;

  // The answer, in a box
  ctx.font = `800 25px ${fonts.heading}`;
  const ans = `Answer: ${book.worked.answer}`;
  const aw = Math.min(w, ctx.measureText(ans).width + 36);
  ctx.fillStyle = 'rgba(10,95,184,0.1)';
  ctx.strokeStyle = 'rgba(10,95,184,0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y - 6, aw, 52, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0a5fb8';
  ctx.fillText(ans, x + 18, y + 29);
  return c;
}

/** The left-hand page (inside the cover): the book's name and its chapters. */
function insideCanvas(book: Book, fonts: { heading: string; body: string }): HTMLCanvasElement {
  const { c, ctx } = paper('right');
  const x = 40;
  const w = 480 - x - 52;
  let y = 64;
  ctx.fillStyle = book.color;
  ctx.font = `800 17px ${fonts.body}`;
  ctx.fillText('NCERT', x, y);
  y += 40;
  ctx.fillStyle = '#0b1020';
  ctx.font = `800 31px ${fonts.heading}`;
  for (const l of wrap(ctx, book.title.replace('NCERT ', ''), w)) {
    ctx.fillText(l, x, y);
    y += 38;
  }
  y += 18;
  ctx.fillStyle = '#5a6280';
  ctx.font = `700 17px ${fonts.body}`;
  ctx.fillText('IN THIS BOOK', x, y);
  y += 34;
  book.chapters.forEach((ch) => {
    const on = ch === book.worked.chapter;
    ctx.fillStyle = on ? book.color : '#20263f';
    ctx.font = `${on ? 800 : 500} 21px ${fonts.body}`;
    const lines = wrap(ctx, ch, w - 22);
    ctx.beginPath();
    ctx.arc(x + 6, y - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    for (const l of lines) {
      ctx.fillText(l, x + 22, y);
      y += 28;
    }
    y += 8;
  });
  return c;
}

/** The inside of the cover (the board's underside) as the left page of the open spread. */
function insideTurn(src: HTMLCanvasElement): HTMLCanvasElement {
  return quarterTurn(src, 960, 1280);
}

/** The page's own fonts (next/font gives them generated family names), for the spine lettering. */
function pageFont(selector: string): string {
  const el = document.querySelector(selector);
  return el ? getComputedStyle(el).fontFamily : 'system-ui, sans-serif';
}

function spineCanvas(book: Book, thick: number, fonts: { heading: string; body: string }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = Math.round(1024 * (thick / L));
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, book.color);
  g.addColorStop(0.5, shade(book.color, 1.18));
  g.addColorStop(1, shade(book.color, 0.75));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  // Two thin bands near the ends, like a printed spine
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(56, 0, 6, c.height);
  ctx.fillRect(c.width - 62, 0, 6, c.height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  // "NCERT" small on the left; the title centred in the space that is left, shrunk to fit.
  ctx.font = `700 ${Math.round(c.height * 0.28)}px ${fonts.body}`;
  ctx.textAlign = 'left';
  ctx.fillText('NCERT', 84, c.height / 2 + 2);
  const left = 84 + ctx.measureText('NCERT').width + 40;
  const right = c.width - 90;
  let size = Math.round(c.height * 0.5);
  ctx.font = `800 ${size}px ${fonts.heading}`;
  while (ctx.measureText(book.spine).width > right - left && size > 10) {
    size -= 2;
    ctx.font = `800 ${size}px ${fonts.heading}`;
  }
  ctx.textAlign = 'center';
  ctx.fillText(book.spine, (left + right) / 2, c.height / 2 + 2);
  return c;
}

function pagesCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f1ebdd';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(120,100,70,0.18)' : 'rgba(120,100,70,0.08)';
    ctx.fillRect(0, y, c.width, 1);
  }
  return c;
}

/** A printed page seen in passing while it turns: paper with grey lines of text. */
function leafCanvas(): HTMLCanvasElement {
  const { c, ctx } = paper('left');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = 'rgba(40,46,70,0.32)';
  ctx.fillRect(56, 60, 190, 12);
  for (let y = 100; y < 590; y += 15) {
    if (rnd() < 0.08) continue; // paragraph gap
    const w = y % 150 < 15 ? 200 + rnd() * 80 : 330 + rnd() * 50;
    ctx.fillStyle = 'rgba(60,64,84,0.16)';
    ctx.fillRect(56, y, w, 5);
  }
  return quarterTurn(c, 960, 1280);
}

/**
 * One sheet of the book (the paperback cover or a paper leaf) that bends as it turns.
 * The sheet starts flat on the right-hand side and turns about the spine line (the hinge's
 * x axis). Mid-turn it curls: the part near the spine leads and the free edge trails, the
 * way paper moves through the air; at rest (closed or open) it lies flat.
 */
type Sheet = {
  mesh: THREE.Mesh;
  base: Float32Array;
  len: number;
  /** Rest height above the hinge line (sheets lie on top of each other). */
  yo: number;
  /** Angle when fully turned. */
  final: number;
  /** How much it curls mid-turn (radians at the free edge); paper curls more than card. */
  curl: number;
  delay: number;
  dur: number;
  p: number;
};

function makeSheet(width: number, len: number, thick: number, mats: THREE.Material[], yo: number, final: number, curl: number, delay: number, dur: number): Sheet {
  const geo = new THREE.BoxGeometry(width, thick, len, 1, 1, SHEET_SEGS);
  geo.translate(0, 0, -len / 2); // from the spine (z = 0) to the fore-edge (z = −len)
  const mesh = new THREE.Mesh(geo, mats);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  return { mesh, base, len, yo, final, curl, delay, dur, p: -1 };
}

const curveY = new Float32Array(SHEET_SEGS * 2 + 1);
const curveZ = new Float32Array(SHEET_SEGS * 2 + 1);

/** Bend a sheet to progress p (0 flat on the right … 1 turned). */
function bendSheet(sh: Sheet, p: number) {
  if (Math.abs(sh.p - p) < 1e-4) return;
  sh.p = p;
  const e = p * p * (3 - 2 * p);
  const ang = e * sh.final;
  const bend = Math.sin(Math.PI * p) * sh.curl;
  const phi = (u: number) => Math.min(sh.final, Math.max(0, ang - bend * u));
  const n = curveY.length - 1;
  const ds = sh.len / n;
  curveY[0] = 0;
  curveZ[0] = 0;
  for (let i = 1; i <= n; i++) {
    const f = phi((i - 0.5) / n);
    curveY[i] = curveY[i - 1] + Math.sin(f) * ds;
    curveZ[i] = curveZ[i - 1] - Math.cos(f) * ds;
  }
  const pos = sh.mesh.geometry.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let v = 0; v < arr.length; v += 3) {
    const x = sh.base[v];
    const y = sh.base[v + 1] + sh.yo;
    const u = Math.min(1, Math.max(0, -sh.base[v + 2] / sh.len));
    const k = u * n;
    const i0 = Math.min(n - 1, Math.floor(k));
    const fr = k - i0;
    const cy = curveY[i0] + (curveY[i0 + 1] - curveY[i0]) * fr;
    const cz = curveZ[i0] + (curveZ[i0 + 1] - curveZ[i0]) * fr;
    const f = phi(u);
    arr[v] = x;
    arr[v + 1] = cy + y * Math.cos(f);
    arr[v + 2] = cz + y * Math.sin(f);
  }
  pos.needsUpdate = true;
  sh.mesh.geometry.computeVertexNormals();
  sh.mesh.geometry.computeBoundingSphere();
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

type Props = {
  books: Book[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onFail: () => void;
};

export default function BooksScene({ books, selected, onSelect, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const selectedRef = useRef<number | null>(selected);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  // Lets the selection effect below reach the scene's state.
  const apiRef = useRef<{ select: (i: number | null) => void } | null>(null);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';
    host.appendChild(renderer.domElement);
    // If the browser takes the context away (too many 3D scenes, GPU reset), show the flat version.
    const onLost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const lookAt = new THREE.Vector3(0, 1.0, 0);
    // Three framings, eased between: the pile alone; a book standing beside the pile; and an
    // open book filling the stage (the pile has slid away), seen nearly straight on.
    let distPile = 9;
    let distOpen = 6;
    let narrow = false;
    let fit5 = 12;
    const cam = { x: STACK_X, y: 1.1, dist: 9, elev: 0.42 };
    const camTarget = (t: number) => {
      if (shownIndex === null) return { x: STACK_X, y: 1.1, dist: distPile, elev: 0.42 };
      if (narrow && !isOpen(t)) return { x: (STACK_X + SHOW_X) / 2, y: 1.1, dist: fit5, elev: 0.42 };
      if (isOpen(t)) return { x: narrow ? OPEN_X : 0, y: L / 2 + 0.25, dist: distOpen, elev: 0.1 };
      return { x: (STACK_X + SHOW_X) / 2, y: 1.1, dist: distPile, elev: 0.42 };
    };
    const placeCamera = () => {
      lookAt.set(cam.x, cam.y, 0);
      camera.position.set(cam.x, cam.y + cam.dist * cam.elev, cam.dist * Math.sqrt(1 - cam.elev * cam.elev));
      camera.lookAt(lookAt);
    };

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
    key.position.set(-3, 7, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3fb8ff, 1.4);
    rim.position.set(5, 3, -5);
    scene.add(rim);

    const disposables: { dispose(): void }[] = [];
    const pagesTex = new THREE.CanvasTexture(pagesCanvas());
    pagesTex.colorSpace = THREE.SRGBColorSpace;
    const pagesSide = new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.95 });
    disposables.push(pagesTex, pagesSide);

    // Soft contact shadow under the pile
    const sh = document.createElement('canvas');
    sh.width = sh.height = 128;
    const sctx = sh.getContext('2d')!;
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sh);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(STACK_X, 0.001, 0);
    scene.add(shadow);
    disposables.push(shadowTex, shadowMat, shadow.geometry);

    const loader = new THREE.ImageLoader();
    const fonts = { heading: pageFont('.landing-h2'), body: pageFont('.landing-lead') };
    type State = {
      mesh: THREE.Mesh;
      thick: number;
      vel: THREE.Vector3;
      phaseAt: number; // when the current move began (s)
      shown: boolean;
      /** The cover, then the leaves, in the order they turn. */
      sheets: Sheet[];
    };
    const leafTex = new THREE.CanvasTexture(leafCanvas());
    leafTex.colorSpace = THREE.SRGBColorSpace;
    leafTex.anisotropy = 4;
    const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.92, side: THREE.FrontSide });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.95 });
    disposables.push(leafTex, leafMat, paperMat);

    const states: State[] = books.map((b, i) => {
      const thick = THICK[i % THICK.length];
      const geo = new THREE.BoxGeometry(L, thick, D);
      const coverMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.55 });
      const spineTex = new THREE.CanvasTexture(spineCanvas(b, thick, fonts));
      spineTex.colorSpace = THREE.SRGBColorSpace;
      spineTex.anisotropy = 4;
      const spineMat = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.5 });
      const backMat = new THREE.MeshStandardMaterial({ color: shade(b.color, 0.8), roughness: 0.7 });
      loader.load(b.cover, (img) => {
        const tex = new THREE.CanvasTexture(quarterTurn(img));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        coverMat.map = tex;
        coverMat.color.set(0xffffff);
        coverMat.needsUpdate = true;
        disposables.push(tex);
      });
      // The page under the cover: this book's worked question.
      const pageTex = new THREE.CanvasTexture(quarterTurn(pageCanvas(b, fonts), 960, 1280));
      pageTex.colorSpace = THREE.SRGBColorSpace;
      pageTex.anisotropy = 4;
      const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 });
      // Faces: +x / −x page edges (the book's top and bottom), +y the first page, −y back cover,
      // +z spine (toward the visitor), −z fore-edge pages.
      const mesh = new THREE.Mesh(geo, [pagesSide, pagesSide, pageMat, backMat, spineMat, pagesSide]);
      mesh.userData.index = i;
      // The sheets turn about the spine line on the top face (+z edge).
      const hinge = new THREE.Group();
      hinge.position.set(0, thick / 2, D / 2);
      const edgeMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6 });
      // The left page of the open spread (title and chapters): the back of the last leaf to
      // turn, which lands on top of the left-hand stack.
      const insideTex = new THREE.CanvasTexture(insideTurn(insideCanvas(b, fonts)));
      insideTex.colorSpace = THREE.SRGBColorSpace;
      insideTex.anisotropy = 4;
      const insideMat = new THREE.MeshStandardMaterial({ map: insideTex, roughness: 0.9 });
      // Box faces: +x, −x, +y (up while on the right), −y (up once turned), +z, −z.
      const sheets: Sheet[] = [
        // NCERT books are paperbacks: a thin card cover that flexes a little.
        makeSheet(L + 0.03, D + 0.015, 0.012, [edgeMat, edgeMat, coverMat, paperMat, edgeMat, edgeMat], 0.006 + LEAVES * 0.0035, OPEN_ANGLE, 0.45, 0, COVER_TURN),
      ];
      for (let k = 0; k < LEAVES; k++) {
        const last = k === LEAVES - 1;
        sheets.push(
          makeSheet(
            L - 0.03,
            D - 0.02,
            0.003,
            [paperMat, paperMat, leafMat, last ? insideMat : leafMat, paperMat, paperMat],
            0.002 + (LEAVES - 1 - k) * 0.0035,
            // Each later leaf lands a hair above the one before it on the left-hand stack.
            OPEN_ANGLE - 0.02 * (k + 1),
            1.15,
            COVER_TURN * 0.55 + k * LEAF_GAP,
            LEAF_TURN,
          ),
        );
      }
      sheets.forEach((sh) => {
        sh.mesh.userData.index = i;
        hinge.add(sh.mesh);
        bendSheet(sh, 0);
        disposables.push(sh.mesh.geometry);
      });
      mesh.add(hinge);
      scene.add(mesh);
      disposables.push(geo, coverMat, spineMat, spineTex, backMat, pageTex, pageMat, edgeMat, insideMat, insideTex);
      return { mesh, thick, vel: new THREE.Vector3(), phaseAt: -10, shown: false, sheets };
    });

    let order = books.map((_, i) => i); // bottom → top
    let shownIndex: number | null = null;
    const isOpen = (t: number) => shownIndex !== null && t - states[shownIndex].phaseAt > OPEN_AFTER;
    let hovered = -1;
    const clock = new THREE.Clock();

    // Lying flat: identity plus a little yaw. Shown: cover to the visitor, top up, spine left.
    const lyingQ = (i: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, YAW[i % YAW.length], 0));
    const shownQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
    );
    // Standing, it leans back a touch and turns toward the pile, so it reads as an object;
    // once open it faces the visitor squarely, so the page can be read.
    const standQ = shownQ.clone().premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0.28, 0)));
    const openQ = shownQ.clone().premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.03, 0, 0)));

    const slotY = (i: number) => {
      let y = 0;
      for (const j of order) {
        if (j === i) return y + states[j].thick / 2;
        y += states[j].thick + 0.01;
      }
      return y;
    };
    const pileTop = () => order.reduce((y, j) => y + states[j].thick + 0.01, 0);

    const target = (i: number, t: number) => {
      const s = states[i];
      const since = t - s.phaseAt;
      if (s.shown) {
        // Lift out toward the visitor first, then stand up beside the pile.
        if (since < 0.28) return { pos: new THREE.Vector3(STACK_X, slotY(i) + 0.25, 1.5), q: lyingQ(i) };
        const bob = reduceMotion ? 0 : Math.sin(t * 1.2) * 0.03;
        if (since > OPEN_AFTER) return { pos: new THREE.Vector3(OPEN_X, L / 2 + 0.25 + bob, 0.5), q: openQ };
        return { pos: new THREE.Vector3(SHOW_X, L / 2 + 0.2 + bob, 0.6), q: standQ };
      }
      const restY = slotY(i);
      // While a book is open the pile slides right, out of the way.
      const pileX = STACK_X + (isOpen(t) ? PILE_AWAY : 0);
      // Coming back: arc above the pile, then settle on top.
      if (since < 0.4) return { pos: new THREE.Vector3(pileX, pileTop() + 1.2, 0.5), q: lyingQ(i) };
      const peek = hovered === i ? 0.4 : 0;
      return { pos: new THREE.Vector3(pileX + NUDGE[i % NUDGE.length], restY, peek), q: lyingQ(i) };
    };

    // Place everything at rest before the first frame.
    states.forEach((s, i) => {
      const { pos, q } = target(i, 99);
      s.mesh.position.copy(pos);
      s.mesh.quaternion.copy(q);
    });

    const select = (i: number | null) => {
      const t = clock.getElapsedTime();
      if (shownIndex !== null && shownIndex !== i) {
        const back = shownIndex;
        states[back].shown = false;
        states[back].phaseAt = t;
        order = putOnTop(order, back);
      }
      if (i !== null && i !== shownIndex) {
        order = takeFromPile(order, i);
        states[i].shown = true;
        states[i].phaseAt = t;
      }
      shownIndex = i;
      wake();
    };
    apiRef.current = { select };

    let camReady = false;
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      const fovV = THREE.MathUtils.degToRad(camera.fov);
      const fit = (w: number, h: number) =>
        Math.max(h / 2 / Math.tan(fovV / 2), w / 2 / (Math.tan(fovV / 2) * camera.aspect));
      // A narrow stage (phones, portrait tablets) frames less, so text stays readable:
      // the pile alone, and the printed page alone once a book is open.
      narrow = camera.aspect < 1.3;
      // The pile with a book standing beside it: about 5.0 × 3.1 units.
      distPile = fit(narrow ? 3.4 : 5.0, 3.1) * 1.05;
      fit5 = fit(5.0, 3.1) * 1.05;
      // The open book: the whole spread (about 2.95 × 2.0) or, when narrow, the page alone.
      distOpen = narrow ? fit(1.75, 2.45) : fit(3.5, 2.75);
      if (!camReady) {
        Object.assign(cam, camTarget(0));
        camReady = true;
      }
      placeCamera();
      camera.updateProjectionMatrix();
      wake();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        states.map((s) => s.mesh),
        true,
      )[0];
      return hit ? (hit.object.userData.index as number) : -1;
    };
    const onMove = (e: PointerEvent) => {
      const i = pick(e);
      const next = i !== -1 && i !== shownIndex ? i : -1;
      renderer.domElement.style.cursor = i === -1 ? 'default' : 'pointer';
      if (next !== hovered) {
        hovered = next;
        wake();
      }
    };
    const onClick = (e: PointerEvent) => {
      const i = pick(e);
      if (i === -1) return;
      onSelectRef.current(i === shownIndex ? null : i);
    };
    const onLeave = () => {
      hovered = -1;
      wake();
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('click', onClick);

    let raf = 0;
    let visible = false;
    let last = 0;
    function wake() {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function frame() {
      raf = 0;
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, t - last || 0.016);
      last = t;
      let moving = false;
      states.forEach((s, i) => {
        const { pos, q } = target(i, t);
        // Once the book has stood up the cover turns, then the leaves riffle over one by one,
        // each on its own clock. Going back, every sheet closes together, quickly.
        const opening = s.shown && t - s.phaseAt > OPEN_AFTER;
        const openedFor = t - s.phaseAt - OPEN_AFTER;
        s.sheets.forEach((sh) => {
          let p: number;
          if (reduceMotion) p = opening ? 1 : 0;
          else if (opening) p = Math.min(1, Math.max(0, (openedFor - sh.delay) / sh.dur));
          else p = sh.p < 1e-3 ? 0 : THREE.MathUtils.lerp(sh.p, 0, 1 - Math.exp(-10 * dt));
          if (opening ? p < 1 : p > 0) moving = true;
          bendSheet(sh, p);
        });
        if (reduceMotion) {
          s.mesh.position.copy(pos);
          s.mesh.quaternion.copy(q);
          return;
        }
        // Spring per axis: a little bounce, so falling books land and settle.
        const k = 140;
        const c = 15;
        const p = s.mesh.position;
        s.vel.x += ((pos.x - p.x) * k - s.vel.x * c) * dt;
        s.vel.y += ((pos.y - p.y) * k - s.vel.y * c) * dt;
        s.vel.z += ((pos.z - p.z) * k - s.vel.z * c) * dt;
        p.addScaledVector(s.vel, dt);
        s.mesh.quaternion.slerp(q, 1 - Math.exp(-9 * dt));
        if (s.vel.lengthSq() > 1e-5 || p.distanceToSquared(pos) > 1e-5 || s.mesh.quaternion.angleTo(q) > 1e-3) moving = true;
      });
      const ct = camTarget(t);
      const k2 = reduceMotion ? 1 : 1 - Math.exp(-4 * dt);
      cam.x += (ct.x - cam.x) * k2;
      cam.y += (ct.y - cam.y) * k2;
      cam.dist += (ct.dist - cam.dist) * k2;
      cam.elev += (ct.elev - cam.elev) * k2;
      if (Math.abs(ct.x - cam.x) + Math.abs(ct.dist - cam.dist) + Math.abs(ct.elev - cam.elev) > 1e-3) moving = true;
      placeCamera();
      const sx = STACK_X + (isOpen(t) ? PILE_AWAY : 0);
      shadow.position.x += (sx - shadow.position.x) * k2;
      renderer.render(scene, camera);
      const bobbing = shownIndex !== null && !reduceMotion;
      if (visible && (moving || bobbing)) raf = requestAnimationFrame(frame);
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
    if (selectedRef.current !== null) select(selectedRef.current);

    return () => {
      apiRef.current = null;
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('click', onClick);
      disposables.forEach((d) => d.dispose());
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [books, onFail, reduceMotion]);

  // Selection comes from React (the card's buttons, the keyboard list, or a click here).
  useEffect(() => {
    selectedRef.current = selected;
    apiRef.current?.select(selected);
  }, [selected]);

  return <div ref={hostRef} className="h-[380px] w-full sm:h-[420px]" />;
}
