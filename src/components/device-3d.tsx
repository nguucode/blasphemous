"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { DEVICE_MODELS, type ModelId } from "@/lib/device-models";

// Screen content is a real DOM node (the Figma iframe) placed by CSS3DRenderer underneath a
// transparent WebGL canvas. The model's own screen mesh punches a hole in the canvas so the
// iframe shows through and stays clickable at any angle; the body occludes it from behind.

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

const holeMaterial = (polygonOffsetFactor: number) =>
  // Writes alpha 0 so the CSS3D iframe shows through.
  new THREE.MeshBasicMaterial({
    color: 0x000000, opacity: 0, blending: THREE.NoBlending, polygonOffset: true, polygonOffsetFactor, polygonOffsetUnits: polygonOffsetFactor,
  });

// Loads the model in millimetres, facing +z, centred on the origin. Returns the screen's box and corner radius.
async function loadModel(id: ModelId) {
  const m = DEVICE_MODELS[id];
  const { scene: model } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(m.url);
  const device = new THREE.Group();
  device.add(model);
  const glass: THREE.MeshStandardMaterial[] = [];

  if (m.kind === "tablet") {
    // Already in mm and centred, screen facing +z.
    if (m.bezel) {
      const { w, h, radius, z } = m.bezel;
      const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w, h, radius), 24), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.15 }));
      bezel.position.z = z;
      device.add(bezel);
      glass.push(bezel.material);
    }
    device.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === m.glass) glass.push(o.material as THREE.MeshStandardMaterial);
    });
    const { w, h, radius, x = 0, y, z } = m.screen;
    // A hair in front of the glass; pulled forward in depth too so it never z-fights with it.
    const hole = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w, h, radius), 24), holeMaterial(-1));
    hole.position.set(x, y, z + 0.05);
    device.add(hole);
    device.updateMatrixWorld(true);
    return { device, glass, screen: new THREE.Box3().setFromObject(hole), screenRadius: radius, body: new THREE.Box3().setFromObject(device).getSize(new THREE.Vector3()) };
  }

  model.scale.setScalar(1000); // metres → mm
  model.rotation.y = Math.PI; // model's screen faces -z
  device.updateMatrixWorld(true);
  model.position.sub(new THREE.Box3().setFromObject(device).getCenter(new THREE.Vector3()));
  device.updateMatrixWorld(true);

  let screenMesh: THREE.Mesh | undefined;
  let logoMesh: THREE.Mesh | undefined;
  let panel: THREE.Material | undefined;
  let islandMesh: THREE.Mesh | undefined;
  device.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = o.material as THREE.Material;
    if (material.name === m.screenMaterial) screenMesh = o;
    if (material.name === m.logo.material) logoMesh = o;
    if (material.name === m.logo.paintAs) panel = material;
    if (m.hiddenMaterials.includes(material.name)) o.visible = false;
    if (material.name === m.islandMaterial) islandMesh = o;
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
    device.add(capsule);
  }
  if (!screenMesh) throw new Error(`Model has no ${m.screenMaterial} mesh`);
  // Pushed back a hair so the Dynamic Island and front camera, which sit in the same plane, win the depth test.
  screenMesh.material = holeMaterial(1);

  const screen = new THREE.Box3().setFromObject(screenMesh);
  return {
    device,
    glass,
    screen,
    screenRadius: cornerRadius(screenMesh, screen),
    body: new THREE.Box3().setFromObject(device).getSize(new THREE.Vector3()),
  };
}

export function Device3D({ model, children, resetSignal }: { model: ModelId; children: ReactNode; resetSignal: number }) {
  const cssWidth = DEVICE_MODELS[model].cssWidth;
  const containerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const currentY = useRef(0);
  const wake = useRef(() => {}); // restarts the render loop; set by the main effect
  const [loaded, setLoaded] = useState<boolean | "error">(false);
  const [screenEl] = useState(() => {
    const el = document.createElement("div");
    Object.assign(el.style, { width: `${cssWidth}px`, background: "#000", backfaceVisibility: "hidden" });
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
    const loading = loadModel(model);
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
    loading.then(
      ({ device, glass, screen, screenRadius, body: size }) => {
        if (disposed) return;
        // The front glass mirrors RoomEnvironment's ceiling panels as a white glare; keep the bezel near-black.
        for (const g of glass) Object.assign(g, { envMap: scene.environment, envMapIntensity: 0.15 });
        rotor.add(device);
        // Turn in from an angle on first show, like a product reveal.
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) rotor.rotation.set(0.12, -0.9, 0);
        const w = screen.max.x - screen.min.x;
        const h = screen.max.y - screen.min.y;
        screenEl.style.height = `${Math.round((cssWidth * h) / w)}px`;
        // Outside the phone's silhouette the canvas is transparent, so the iframe's own corners must be rounded too.
        screenEl.style.borderRadius = `${(cssWidth * screenRadius) / w}px`;
        screenEl.style.overflow = "hidden";
        const obj = new CSS3DObject(screenEl);
        obj.scale.setScalar(w / cssWidth);
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
  }, [screenEl, model, cssWidth]);

  return (
    <div ref={containerRef} className="relative h-full w-full cursor-grab touch-pan-y select-none active:cursor-grabbing">
      {loaded !== true && (
        <p className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm text-ink-secondary">
          {loaded === "error" ? "Không tải được mô hình thiết bị." : "Đang tải mô hình…"}
        </p>
      )}
      {createPortal(children, screenEl)}
    </div>
  );
}
