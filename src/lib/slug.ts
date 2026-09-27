// Spec 7.3: a-z, 0-9 and "-", 3–48 chars, no leading or trailing "-".
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,46})[a-z0-9]$/;

// App routes live on the main domain, so these can never be a Demo's slug.
const RESERVED = new Set(["app", "api", "login", "auth", "try", "pricing", "terms", "privacy", "help", "about", "blog", "admin", "www"]);

export const isSlugFormat = (s: string) => SLUG.test(s);
export const isReservedSlug = (s: string) => s.startsWith("_") || RESERVED.has(s);
