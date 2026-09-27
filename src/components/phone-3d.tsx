"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PHONE_MODEL } from "@/lib/phone-model";

// Screen content is a real DOM node (the Figma iframe) placed by CSS3DRenderer underneath a
// transparent WebGL canvas. The model's own screen mesh punches a hole in the canvas so the
// iframe shows through and stays clickable at any angle; the body occludes it from behind.

export const SCREEN_CSS_WIDTH = 393; // iPhone logical points; height follows the model's screen aspect
const FOV = 30;
const MAX_TILT_X = 0.6;

// Loads the model in millimetres, facing +z, centred on the origin.
async function loadPhone() {
  const { scene: model } = await new GLTFLoader().loadAsync(PHONE_MODEL.url);
  model.scale.setScalar(1000); // metres → mm
  model.rotation.y = Math.PI; // model's screen faces -z
  const phone = new THREE.Group();
  phone.add(model);
  phone.updateMatrixWorld(true);
  model.position.sub(new THREE.Box3().setFromObject(phone).getCenter(new THREE.Vector3()));
  phone.updateMatrixWorld(true);

  let screenMesh: THREE.Mesh | undefined;
  phone.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = (o.material as THREE.Material).name;
    if (name === PHONE_MODEL.screenMaterial) screenMesh = o;
    if (name === PHONE_MODEL.glassMaterial) o.visible = false; // sits in front of the screen and would cover the hole
  });
  if (!screenMesh) throw new Error(`Model has no ${PHONE_MODEL.screenMaterial} mesh`);
  // Writes alpha 0 so the CSS3D iframe shows through. Pushed back a hair so the Dynamic Island
  // and front camera, which sit in the same plane, win the depth test.
  screenMesh.material = new THREE.MeshBasicMaterial({
    color: 0x000000, opacity: 0, blending: THREE.NoBlending, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  return {
    phone,
    screen: new THREE.Box3().setFromObject(screenMesh),
    body: new THREE.Box3().setFromObject(phone).getSize(new THREE.Vector3()),
  };
}

export function Phone3D({ children, resetSignal }: { children: ReactNode; resetSignal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const currentY = useRef(0);
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
  }, [resetSignal]);

  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);
    const rotor = new THREE.Group(); // rotated by the user; the model is added once loaded
    scene.add(rotor);
    const cssRotor = new THREE.Group();
    cssScene.add(cssRotor);
    let body = new THREE.Vector3(79, 163, 9);

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

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.z = Math.max((body.y * 1.12) / 2 / t, (body.x * 1.8) / 2 / (t * camera.aspect));
      camera.updateProjectionMatrix();
      gl.setSize(w, h);
      css.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let disposed = false;
    loadPhone().then(
      ({ phone, screen, body: size }) => {
        if (disposed) return;
        rotor.add(phone);
        const w = screen.max.x - screen.min.x;
        const h = screen.max.y - screen.min.y;
        screenEl.style.height = `${Math.round((SCREEN_CSS_WIDTH * h) / w)}px`;
        const obj = new CSS3DObject(screenEl);
        obj.scale.setScalar(w / SCREEN_CSS_WIDTH);
        obj.position.copy(screen.getCenter(new THREE.Vector3()));
        cssRotor.add(obj);
        body = size;
        resize();
        setLoaded(true);
      },
      (err) => {
        console.error(err);
        if (!disposed) setLoaded("error");
      },
    );

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
      rotor.rotation.x += (target.current.x - rotor.rotation.x) * 0.15;
      rotor.rotation.y += (target.current.y - rotor.rotation.y) * 0.15;
      currentY.current = rotor.rotation.y;
      cssRotor.rotation.copy(rotor.rotation);
      gl.render(scene, camera);
      css.render(cssScene, camera);
    };
    tick();

    return () => {
      disposed = true;
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
      css.domElement.remove();
      gl.domElement.remove();
    };
  }, [screenEl]);

  return (
    <div ref={containerRef} className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing">
      {loaded !== true && (
        <p className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm text-white/70">
          {loaded === "error" ? "Không tải được mô hình điện thoại." : "Đang tải mô hình…"}
        </p>
      )}
      {createPortal(children, screenEl)}
    </div>
  );
}
