import images from "../client/src/lib/page-backgrounds.json";
export function pageBackground(path: string): string | undefined {
  const plain = (path.split(/[?#]/)[0] || "/").replace(/^\/ar(?=\/|$)/, "") || "/";
  if (plain === "/") return "/images/home-mosque.webp";
  if (/^\/(courses|programs)(?:\/|$)/.test(plain)) return images.courses.src;
  if (/^\/blog(?:\/|$)/.test(plain)) return images.journal.src;
  const variants = { "/pricing": "pricing", "/how-it-works": "journey", "/contact": "contact", "/about": "about", "/apply": "apply" } as const;
  const key = variants[plain as keyof typeof variants];
  const image = key ? images[key].src : undefined;
  return image && /^\/images\/[a-zA-Z0-9._-]+$/.test(image) ? image : undefined;
}

export function backgroundPreload(path: string): string {
  const image = pageBackground(path);
  return image ? `<link data-background-priority rel="preload" as="image" href="${image}" fetchpriority="high">` : "";
}
