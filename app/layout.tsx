import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "../components/Nav";

export const metadata: Metadata = {
  title: "Student Command Center",
  description:
    "An AI-powered student assistant that turns messy school life into clear, personalized support.",
};

// Inline script that runs before React hydration to set the correct theme
// class on <html> — prevents flash of wrong theme (FOUC).
const themeInitScript = `
(function() {
  try {
    var mode = localStorage.getItem('scc-theme-mode') || 'light';
    var accent = localStorage.getItem('scc-theme-accent') || 'forest';
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var accents = { forest: '74 222 128', ocean: '56 189 248', amethyst: '167 139 250', sunset: '251 146 60', rose: '244 114 182' };
    document.documentElement.style.setProperty('--sidebar-accent', accents[accent] || accents.forest);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script mutates data-theme before
    // React hydrates, so the server/client HTML will differ intentionally.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <Nav />
          {/* pb-[72px] prevents content from hiding behind the mobile bottom nav */}
          <div className="pb-[72px] md:pb-0">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
