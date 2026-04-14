"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { applyBrandingCssVariables, getBestForegroundColor, normalizeHexColor } from "@/lib/branding";

interface BrandingConfig {
  primaryColor: string;
  primaryForeground: string;
  logoUrl: string;
  faviconUrl: string;
}

const BrandingContext = createContext<BrandingConfig>({
  primaryColor: "#00463c",
  primaryForeground: "#ffffff",
  logoUrl: "/docmorris-logo.png",
  faviconUrl: "/favicon.ico",
});

export const useBranding = () => useContext(BrandingContext);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BrandingConfig>({
    primaryColor: "#00463c",
    primaryForeground: "#ffffff",
    logoUrl: "/docmorris-logo.png",
    faviconUrl: "/favicon.ico",
  });

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch("/api/branding");
        if (res.ok) {
          const data = await res.json();
          const normalizedPrimary = normalizeHexColor(data.BRAND_PRIMARY_COLOR);
          const newConfig = {
            primaryColor: normalizedPrimary,
            primaryForeground: getBestForegroundColor(normalizedPrimary),
            logoUrl: data.BRAND_LOGO_URL || "/docmorris-logo.png",
            faviconUrl: data.BRAND_FAVICON_URL || "/favicon.ico",
          };
          setConfig(newConfig);
          applyBranding(newConfig);
        }
      } catch (err) {
        console.error("Failed to fetch branding config:", err);
      }
    };

    fetchBranding();

    const handleBrandingUpdated = () => {
      fetchBranding();
    };

    window.addEventListener("branding-updated", handleBrandingUpdated);

    return () => {
      window.removeEventListener("branding-updated", handleBrandingUpdated);
    };
  }, []);

  const applyBranding = (cfg: BrandingConfig) => {
    applyBrandingCssVariables(cfg.primaryColor);
    
    // Update Favicon
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = cfg.faviconUrl;
  };

  return (
    <BrandingContext.Provider value={config}>
      {children}
    </BrandingContext.Provider>
  );
}
