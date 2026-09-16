import type { Metadata, Viewport } from "next";
import { getLocale } from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Directory",
  description: "A secure directory for approved members.",
  applicationName: "Private Directory",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Directory" },
  icons: { icon: "/app-icon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3e6651",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement,p='system';try{p=localStorage.getItem('directory-theme')||'system'}catch(e){}if(!['system','light','dark'].includes(p))p='system';r.dataset.themePreference=p;var m=matchMedia('(prefers-color-scheme: dark)');function apply(){r.dataset.theme=r.dataset.themePreference==='system'?(m.matches?'dark':'light'):r.dataset.themePreference}apply();m.addEventListener('change',apply)})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
