// Where to go after sign-in. Only same-site paths: "//evil.com" and "/\evil.com" are other sites to a browser.
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])/.test(next) ? next : "/app");
