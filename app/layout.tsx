import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "../components/Nav";
import {
  DEFAULT_THEME_PRESET,
  THEME_PRESETS,
  THEME_STORAGE_KEYS,
} from "../lib/theme-system";

const APP_NAME = "Student Command Center";
const APP_DESCRIPTION =
  "An AI-powered student assistant that turns messy school life into clear, personalized support.";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ["/icons/icon-192.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f2117" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1b13" },
  ],
};

const themeInitScript = `
(function() {
  try {
    var keys = ${JSON.stringify(THEME_STORAGE_KEYS)};
    var presets = ${JSON.stringify(THEME_PRESETS)};
    var defaultPreset = ${JSON.stringify(DEFAULT_THEME_PRESET)};
    var mode = localStorage.getItem(keys.mode) || 'system';
    var preset = localStorage.getItem(keys.preset);
    if (!preset) {
      var legacyAccent = localStorage.getItem(keys.accent);
      var legacySidebar = localStorage.getItem(keys.sidebar);
      if (legacySidebar === 'ocean' || legacyAccent === 'ocean') preset = 'ocean';
      else if (legacySidebar === 'midnight' || legacySidebar === 'slate') preset = 'graphite';
      else if (legacyAccent === 'sunset' || legacyAccent === 'rose') preset = 'sunrise';
      else preset = defaultPreset;
    }
    if (!presets[preset]) preset = defaultPreset;
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-preset', preset);
    var tokens = dark ? presets[preset].dark : presets[preset].light;
    var hexToRgbTriplet = function(hex) {
      var normalized = hex.replace(/^#/, '');
      var expanded = normalized.length === 3
        ? normalized.split('').map(function(part) { return part + part; }).join('')
        : normalized;
      return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16)
      ].join(' ');
    };
    Object.keys(tokens).forEach(function(token) {
      document.documentElement.style.setProperty('--' + token, hexToRgbTriplet(tokens[token]));
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="app-safe-shell">
          <Providers>
            <Nav />
            <div className="app-shell-offset">{children}</div>
          </Providers>
        </div>
      </body>
    </html>
  );
}
