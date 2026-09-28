// Blasphemous is a personal product of ontheshore (decided 2026-09-28): one domain for the app
// and Demo Links, blasphemous.ontheshore.biz. Set DEMO_HOST to it when deployed (see .env.example).
export const SITE = {
  maker: "ontheshore",
  makerUrl: "https://ontheshore.biz",
  contactEmail: "kafka@ontheshore.biz",
};

export const moreDemosMailto = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("Cần thêm Demo")}`;
