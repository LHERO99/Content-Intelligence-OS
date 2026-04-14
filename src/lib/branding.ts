const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

export function normalizeHexColor(value: string | undefined | null, fallback = "#00463c"): string {
  const candidate = String(value || "").trim();
  if (HEX_COLOR_REGEX.test(candidate)) return candidate.toLowerCase();
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

function channelToLinear(value: number): number {
  const channel = value / 255;
  if (channel <= 0.03928) return channel / 12.92;
  return Math.pow((channel + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lr = channelToLinear(r);
  const lg = channelToLinear(g);
  const lb = channelToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getBestForegroundColor(backgroundHex: string): "#ffffff" | "#000000" {
  const bg = normalizeHexColor(backgroundHex);
  const whiteRatio = contrastRatio(bg, "#ffffff");
  const blackRatio = contrastRatio(bg, "#000000");
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

export function applyBrandingCssVariables(primaryHex: string): void {
  const primary = normalizeHexColor(primaryHex);
  const foreground = getBestForegroundColor(primary);
  document.documentElement.style.setProperty("--primary", primary);
  document.documentElement.style.setProperty("--primary-foreground", foreground);
  document.documentElement.style.setProperty("--sidebar-primary", primary);
  document.documentElement.style.setProperty("--sidebar-primary-foreground", foreground);
  document.documentElement.style.setProperty("--ring", primary);
}
