"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Screen content is a real DOM node (the Figma iframe) placed by CSS3DRenderer underneath a
// transparent WebGL canvas. The screen mesh punches a hole in the canvas so the iframe shows
// through and stays clickable at any angle; the phone body occludes it when seen from behind.
// ponytail: phone modelled in code as a stand-in; swap buildPhone() for a GLTF model once the file is in /public/models.

export const SCREEN_CSS = { width: 393, height: 852 }; // iPhone 15 logical points
const MM_PER_PT = 0.172;
const SCREEN = { w: SCREEN_CSS.width * MM_PER_PT, h: SCREEN_CSS.height * MM_PER_PT, r: 55 * MM_PER_PT };
const BODY = { w: SCREEN.w + 4, h: SCREEN.h + 4, d: 7.8, r: SCREEN.r + 2 };
const FOV = 30;
const MAX_TILT_X = 0.6;

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function buildPhone() {
  const phone = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a4a4f, metalness: 0.9, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.2, roughness: 0.05 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const front = BODY.d / 2;

  const bevel = 1.2;
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(BODY.w - 2 * bevel, BODY.h - 2 * bevel, BODY.r - bevel), {
      depth: BODY.d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 5, curveSegments: 32,
    }),
    metal,
  );
  body.geometry.translate(0, 0, -(BODY.d - 2 * bevel) / 2);
  phone.add(body);

  const frontGlass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(BODY.w - 0.8, BODY.h - 0.8, BODY.r - 0.4), 32), glass);
  frontGlass.position.z = front + 0.01;
  phone.add(frontGlass);

  // Transparent "hole": writes alpha 0 so the CSS3D iframe underneath shows through.
  const hole = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRect(SCREEN.w, SCREEN.h, SCREEN.r), 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending }),
  );
  hole.position.z = front + 0.02;
  phone.add(hole);

  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(126 * MM_PER_PT, 37 * MM_PER_PT, 18.5 * MM_PER_PT), 16), black);
  island.position.set(0, SCREEN.h / 2 - (11 + 18.5) * MM_PER_PT, front + 0.03);
  phone.add(island);

  const bump = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(30, 30, 7), { depth: 1, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, curveSegments: 16 }),
    glass,
  );
  bump.rotation.y = Math.PI;
  bump.position.set(BODY.w / 2 - 19, BODY.h / 2 - 19, -front + 0.1);
  phone.add(bump);
  for (const [x, y] of [[-7, 7], [-7, -7], [7, 0]]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 32), black);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(bump.position.x - x, bump.position.y + y, -front - 1.4);
    phone.add(lens);
  }

  const button = (x: number, y: number, h: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, h, 3), metal);
    b.position.set(x, y, 0);
    phone.add(b);
  };
  button(-BODY.w / 2 - 0.3, 45, 7); // action
  button(-BODY.w / 2 - 0.3, 30, 13); // volume up
  button(-BODY.w / 2 - 0.3, 14, 13); // volume down
  button(BODY.w / 2 + 0.3, 28, 22); // side
  return { phone, screenZ: front + 0.02 };
}

export function Phone3D({ children, resetSignal }: { children: ReactNode; resetSignal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const currentY = useRef(0);
  const [screenEl] = useState(() => {
    const el = document.createElement("div");
    Object.assign(el.style, {
      width: `${SCREEN_CSS.width}px`, height: `${SCREEN_CSS.height}px`, borderRadius: `${55}px`,
      overflow: "hidden", background: "#000", backfaceVisibility: "hidden",
    });
    return el;
  });

  useEffect(() => {
    // Nearest full turn, so a phone spun several times comes back the short way.
    const turn = 2 * Math.PI;
    target.current = { x: 0, y: Math.round(currentY.current / turn) * turn };
  }, [resetSignal]);

  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);

    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    gl.setPixelRatio(Math.min(devicePixelRatio, 2));
    gl.setClearColor(0x000000, 0);
    Object.assign(gl.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    const css = new CSS3DRenderer();
    Object.assign(css.domElement.style, { position: "absolute", inset: "0" });
    container.append(css.domElement, gl.domElement);

    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(80, 120, 200);
    scene.add(key);

    const { phone, screenZ } = buildPhone();
    scene.add(phone);
    const screen = new CSS3DObject(screenEl);
    screen.scale.setScalar(MM_PER_PT);
    screen.position.z = screenZ;
    const cssPhone = new THREE.Group();
    cssPhone.add(screen);
    cssScene.add(cssPhone);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.z = Math.max((BODY.h * 1.12) / 2 / t, (BODY.w * 1.8) / 2 / (t * camera.aspect));
      camera.updateProjectionMatrix();
      gl.setSize(w, h);
      css.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      container.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      if (e.buttons === 0) return (drag = null); // pointerup was lost (e.g. released over the iframe)
      target.current.y += (e.clientX - drag.x) * 0.008;
      target.current.x = THREE.MathUtils.clamp(target.current.x + (e.clientY - drag.y) * 0.008, -MAX_TILT_X, MAX_TILT_X);
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => (drag = null);
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!container.clientWidth) return; // hidden (another Device is showing)
      phone.rotation.x += (target.current.x - phone.rotation.x) * 0.15;
      phone.rotation.y += (target.current.y - phone.rotation.y) * 0.15;
      currentY.current = phone.rotation.y;
      cssPhone.rotation.copy(phone.rotation);
      gl.render(scene, camera);
      css.render(cssScene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      scene.environment?.dispose();
      pmrem.dispose();
      gl.dispose();
      gl.forceContextLoss();
      container.replaceChildren();
    };
  }, [screenEl]);

  return (
    <div ref={containerRef} className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing">
      {createPortal(children, screenEl)}
    </div>
  );
}
