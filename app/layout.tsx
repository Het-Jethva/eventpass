import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getConfiguredApplicationUrl } from "@/lib/application-url";
import "./globals.css";

// The whole product speaks in one face. Geist Sans is variable, so a headline
// can sit at 560 without loading a second file, and its character variants keep
// Il1 apart at the sizes a roster actually renders at.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Ticket Codes, Event Slugs, and timestamps only — text a person reads aloud,
// types, or compares character by character. Crockford Base32 already drops I,
// L, O, and U; the face's job is keeping 5/S, 2/Z, 8/B, and 6/G apart.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = getConfiguredApplicationUrl();
const siteDescription =
  "Event registration, tickets, and door check-in, on a scanner that keeps working when the venue network does not.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "EventPass",
    template: "%s · EventPass",
  },
  description: siteDescription,
  applicationName: "EventPass",
  openGraph: {
    type: "website",
    siteName: "EventPass",
    title: "EventPass",
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "EventPass",
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EventPass",
  },
};

// Browser chrome follows the active theme. The manifest carries a single
// colour, so the per-scheme values live here.
//
// These are the only hex literals in the product. The browser will not read a
// CSS custom property for the address bar. They are the sRGB conversions of
// `--background` in each theme. Re-derive them if `--background` moves.
//
// The `media` conditions are the correct first paint, and only that. They answer
// the OS, while the product answers the stored preference. THEME_SCRIPT below
// re-points them once a viewer has chosen.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfdfe" },
    { media: "(prefers-color-scheme: dark)", color: "#090c11" },
  ],
};

// One owner for which theme is on. First paint, OS changes, other tabs, and
// the switcher all arrive here.
const THEME_SCRIPT = `(function(){
var K='eventpass-theme';
var q=window.matchMedia('(prefers-color-scheme: dark)');
function paint(dark){
  var m=document.querySelectorAll('meta[name="theme-color"]');
  for(var i=0;i<m.length;i++){
    var t=m[i];
    if(!t.dataset.scheme)t.dataset.scheme=/dark/.test(t.media)?'dark':'light';
    t.media=((t.dataset.scheme==='dark')===dark)?'all':'not all';
  }
}
function apply(){
  var s=null;try{s=localStorage.getItem(K)}catch(e){}
  var dark=s==='dark'||(s!=='light'&&q.matches);
  document.documentElement.classList.toggle('dark',dark);
  paint(dark);
}
window.__eventpassTheme=apply;
apply();
q.addEventListener('change',apply);
window.addEventListener('storage',function(e){if(!e.key||e.key===K)apply()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
