// demoBase comes from the server (lib/session demoBase): "https://blasphemous.ontheshore.biz", or this dev server's origin.
export const demoUrl = (demoBase: string, slug: string) => `${demoBase}/${slug}`;
export const displayUrl = (demoBase: string, slug: string) => demoUrl(demoBase, slug).replace(/^https?:\/\//, "");
