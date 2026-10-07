// 3D device models and the credit their CC BY 4.0 licenses require on any page that shows them.
// The iPads come from kusabimaru-models (already in mm, centred, screen facing +z); the iPhone is the
// original Sketchfab export (metres, screen facing -z).

export type Credit = { title: string; url: string; author: string; authorUrl?: string };

type Common = {
  label: string;
  url: string;
  // Width of the CSS screen in logical points; height follows the screen's aspect.
  cssWidth: number;
  credit: Credit;
};

export type DeviceModel = Common &
  (
    | {
        kind: "iphone";
        screenMaterial: string;
        // Front glass sits in front of the screen and would cover the hole.
        hiddenMaterials: string[];
        // The Apple logo (a trademark) fills a cutout in the back panel, so it is repainted with the panel's material.
        logo: { material: string; paintAs: string };
        // Dynamic Island outline. The model leaves its inside open, so a solid black capsule is drawn over it.
        islandMaterial: string;
      }
    | {
        kind: "tablet";
        // Display area in mm, centred at (x, y), facing +z at z.
        screen: { w: number; h: number; radius: number; x?: number; y: number; z: number };
        // Front glass material, dimmed so it reads as a black bezel instead of mirroring the environment.
        glass: string;
        // Black front glass for a model that lacks one.
        bezel?: { w: number; h: number; radius: number; z: number };
      }
  );

export type ModelId = "iphone-17-pro-max" | "ipad-pro-12-9" | "ipad-air-11";

export const DEVICE_MODELS: Record<ModelId, DeviceModel> = {
  "iphone-17-pro-max": {
    kind: "iphone",
    label: "iPhone 17 Pro Max",
    url: "/models/iphone-17-pro-max.glb",
    cssWidth: 393,
    screenMaterial: "17ProMax_Screen",
    hiddenMaterials: ["17ProMax_glass"],
    logo: { material: "17ProMax_Logo", paintAs: "17ProMax_color2" },
    islandMaterial: "17ProMax_2112",
    credit: {
      title: "iPhone 17 Pro Max",
      url: "https://sketchfab.com/3d-models/iphone-17-pro-max-e7c5674931ae4b0ea1b4eaaabb159fdb",
      author: "Taufiq K",
      authorUrl: "https://sketchfab.com/fqrhmn",
    },
  },
  "ipad-pro-12-9": {
    kind: "tablet",
    label: "iPad Pro 12.9″",
    url: "/models/ipad-pro-12-9.glb",
    cssWidth: 1024,
    screen: { w: 197, h: 262.9, radius: 4, x: -0.62, y: -0.72, z: 4.4 },
    glass: "screen",
    credit: {
      title: "Ipad Pro 12.9 (2020)",
      url: "https://sketchfab.com/3d-models/ipad-pro-129-2020-f0f7674522124f3bbc2d0f898963457e",
      author: "Konstantin Koretskyi",
    },
  },
  "ipad-air-11": {
    kind: "tablet",
    label: "iPad Air 11″",
    url: "/models/ipad-air-11.glb",
    cssWidth: 820,
    screen: { w: 157.8, h: 227.1, radius: 10, y: -0.35, z: 4.05 },
    glass: "Glass_Ti",
    bezel: { w: 176.5, h: 245.6, radius: 17, z: 4.06 },
    credit: { title: "Ipad Air 5 (FREE)", url: "https://sketchfab.com/3d-models/628ab0359d774af480be8eda9de70272", author: "Artbor" },
  },
};

export const LICENSE = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
