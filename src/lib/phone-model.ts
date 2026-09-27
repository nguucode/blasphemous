// The 3D phone model and the credit its CC BY 4.0 license requires on any page that shows it.
export const PHONE_MODEL = {
  url: "/models/iphone-17-pro-max.glb",
  screenMaterial: "17ProMax_Screen",
  // Front glass sits in front of the screen and would cover the hole.
  hiddenMaterials: ["17ProMax_glass"],
  // The Apple logo (a trademark) fills a cutout in the back panel, so it is repainted with the panel's material, not hidden.
  logo: { material: "17ProMax_Logo", paintAs: "17ProMax_color2" },
  credit: {
    title: "iPhone 17 Pro Max",
    url: "https://sketchfab.com/3d-models/iphone-17-pro-max-e7c5674931ae4b0ea1b4eaaabb159fdb",
    author: "Taufiq K",
    authorUrl: "https://sketchfab.com/fqrhmn",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
};
