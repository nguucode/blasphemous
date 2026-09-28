"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { PHONE_MODEL } from "@/lib/phone-model";

// Screen content is a real DOM node (the Figma iframe) placed by CSS3DRenderer underneath a
// transparent WebGL canvas. The model's own screen mesh punches a hole in the canvas so the
// iframe shows through and stays clickable at any angle; the body occludes it from behind.

export const SCREEN_CSS_WIDTH = 393; // iPhone logical points; height follows the model's screen aspect
const FOV = 30;
const MAX_TILT_X = 0.6;
// A 1.5× canvas looks the same on Retina and draws 44% fewer pixels than 2× (75% fewer than a 3× phone).
// While the phone moves, 1× is enough (motion hides it); the resting frame is drawn sharp again.
const MAX_PIXEL_RATIO = 1.5;
const MOVING_PIXEL_RATIO = 1;
// Easing toward the target angle, per second, so it settles in ~1.8 s on a fast or a slow machine alike.
const EASE_PER_SECOND = 5;
// Below this the phone counts as at rest and the render loop stops.
const SETTLED = 1e-4;

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// The screen mesh is a rounded rectangle. Its vertex closest to a sharp corner lies on the arc at 45°,
// offset o = r(1 - 1/√2) from the corner on each axis, which gives the radius back.
function cornerRadius(mesh: THREE.Mesh, box: THREE.Box3) {
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  let nearest = Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    nearest = Math.min(nearest, v.x - box.min.x + (box.max.y - v.y));
  }
  return nearest / 2 / (1 - Math.SQRT1_2);
}

// Loads the model in millimetres, facing +z, centred on the origin.
async function loadPhone() {
  const { scene: model } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(PHONE_MODEL.url);
  model.scale.setScalar(1000); // metres → mm
  model.rotation.y = Math.PI; // model's screen faces -z
  const phone = new THREE.Group();
  phone.add(model);
  phone.updateMatrixWorld(true);
  model.position.sub(new THREE.Box3().setFromObject(phone).getCenter(new THREE.Vector3()));
  phone.updateMatrixWorld(true);

  let screenMesh: THREE.Mesh | undefined;
  let logoMesh: THREE.Mesh | undefined;
  let panel: THREE.Material | undefined;
  let islandMesh: THREE.Mesh | undefined;
  phone.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = o.material as THREE.Material;
    if (material.name === PHONE_MODEL.screenMaterial) screenMesh = o;
    if (material.name === PHONE_MODEL.logo.material) logoMesh = o;
    if (material.name === PHONE_MODEL.logo.paintAs) panel = material;
    if (PHONE_MODEL.hiddenMaterials.includes(material.name)) o.visible = false;
    if (material.name === PHONE_MODEL.islandMaterial) islandMesh = o;
  });
  if (logoMesh && panel) logoMesh.material = panel;
  if (islandMesh) {
    const box = new THREE.Box3().setFromObject(islandMesh);
    const size = box.getSize(new THREE.Vector3());
    const capsule = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRect(size.x, size.y, size.y / 2), 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    capsule.position.set(...box.getCenter(new THREE.Vector3()).toArray());
    capsule.position.z = box.max.z + 0.05;
    phone.add(capsule);
  }
  if (!screenMesh) throw new Error(`Model has no ${PHONE_MODEL.screenMaterial} mesh`);
  // Writes alpha 0 so the CSS3D iframe shows through. Pushed back a hair so the Dynamic Island
  // and front camera, which sit in the same plane, win the depth test.
  screenMesh.material = new THREE.MeshBasicMaterial({
    color: 0x000000, opacity: 0, blending: THREE.NoBlending, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  const screen = new THREE.Box3().setFromObject(screenMesh);
  return {
    phone,
    screen,
    screenRadius: cornerRadius(screenMesh, screen),
    body: new THREE.Box3().setFromObject(phone).getSize(new THREE.Vector3()),
  };
}

export function Phone3D({ children, resetSignal }: { children: ReactNode; resetSignal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const currentY = useRef(0);
  const wake = useRef(() => {}); // restarts the render loop; set by the main effect
  const [loaded, setLoaded] = useState<boolean | "error">(false);
  const [screenEl] = useState(() => {
    const el = document.createElement("div");
    Object.assign(el.style, { width: `${SCREEN_CSS_WIDTH}px`, background: "#000", backfaceVisibility: "hidden" });
    return el;
  });

  useEffect(() => {
    // Nearest full turn, so a phone spun several times comes back the short way.
    const turn = 2 * Math.PI;
    target.current = { x: 0, y: Math.round(currentY.current / turn) * turn };
    wake.current();
  }, [resetSignal]);

  useEffect(() => {
    const container = containerRef.current!;
    // Start the model download before the renderer and environment are built (they take a few hundred ms).
    const phoneLoading = loadPhone();
    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);
    const rotor = new THREE.Group(); // rotated by the user; the model is added once loaded
    scene.add(rotor);
    const cssRotor = new THREE.Group();
    cssScene.add(cssRotor);
    let body = new THREE.Vector3(79, 163, 9);

    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    gl.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
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

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.z = Math.max((body.y * 1.12) / 2 / t, (body.x * 1.8) / 2 / (t * camera.aspect));
      camera.updateProjectionMatrix();
      gl.setSize(w, h); // clears the canvas, so draw again
      css.setSize(w, h);
      wake.current();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Render only while something moves: dragging, or easing toward the target angle. At rest the
    // WebGL canvas and the Figma iframe's CSS transform stay untouched, so an idle phone costs nothing.
    let frame = 0;
    let last = 0;
    let drag: { x: number; y: number } | null = null;
    const restRatio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    const movingRatio = Math.min(restRatio, MOVING_PIXEL_RATIO);
    const tick = (now: number) => {
      frame = 0;
      if (!container.clientWidth) return; // hidden (another Device is showing); resize wakes it when shown
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      const dx = target.current.x - rotor.rotation.x;
      const dy = target.current.y - rotor.rotation.y;
      const settled = !drag && Math.abs(dx) < SETTLED && Math.abs(dy) < SETTLED;
      const k = 1 - Math.exp(-EASE_PER_SECOND * dt);
      rotor.rotation.x = settled ? target.current.x : rotor.rotation.x + dx * k;
      rotor.rotation.y = settled ? target.current.y : rotor.rotation.y + dy * k;
      currentY.current = rotor.rotation.y;
      cssRotor.rotation.copy(rotor.rotation);
      const ratio = settled ? restRatio : movingRatio;
      if (gl.getPixelRatio() !== ratio) gl.setPixelRatio(ratio);
      gl.render(scene, camera);
      css.render(cssScene, camera);
      if (settled) last = 0;
      else frame = requestAnimationFrame(tick);
    };
    wake.current = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    let disposed = false;
    phoneLoading.then(
      ({ phone, screen, screenRadius, body: size }) => {
        if (disposed) return;
        rotor.add(phone);
        // Turn in from an angle on first show, like a product reveal.
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) rotor.rotation.set(0.12, -0.9, 0);
        const w = screen.max.x - screen.min.x;
        const h = screen.max.y - screen.min.y;
        screenEl.style.height = `${Math.round((SCREEN_CSS_WIDTH * h) / w)}px`;
        // Outside the phone's silhouette the canvas is transparent, so the iframe's own corners must be rounded too.
        screenEl.style.borderRadius = `${(SCREEN_CSS_WIDTH * screenRadius) / w}px`;
        screenEl.style.overflow = "hidden";
        const obj = new CSS3DObject(screenEl);
        obj.scale.setScalar(w / SCREEN_CSS_WIDTH);
        obj.position.copy(screen.getCenter(new THREE.Vector3()));
        cssRotor.add(obj);
        body = size;
        resize(); // also wakes the loop for the turn-in
        setLoaded(true);
      },
      (err) => {
        console.error(err);
        if (!disposed) setLoaded("error");
      },
    );

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
      wake.current();
    };
    // touch-action: pan-y lets a vertical swipe scroll the page (the browser then cancels the drag);
    // horizontal swipes still turn the phone.
    const up = () => (drag = null);
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      wake.current = () => {};
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
      css.domElement.remove();
      gl.domElement.remove();
    };
  }, [screenEl]);

  return (
    <div ref={containerRef} className="relative h-full w-full cursor-grab touch-pan-y select-none active:cursor-grabbing">
      {loaded !== true && (
        <p className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm text-ink-secondary">
          {loaded === "error" ? "Không tải được mô hình điện thoại." : "Đang tải mô hình…"}
        </p>
      )}
      {createPortal(children, screenEl)}
    </div>
  );
}
