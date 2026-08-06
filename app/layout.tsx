import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WebVitals } from "@/app/_components/web-vitals";
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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventpass.hetjethva.tech";
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

// Browser chrome follows the active theme. The manifest cannot express this —
// it carries a single colour — so the per-scheme values live here.
//
// These are the only hex literals in the product, and they exist because the
// browser will not read a CSS custom property for the address bar. They are the
// sRGB conversions of `--background` in each theme and nothing else: the dark
// value was #1c1c22 against a real background of #090c11, which put a visibly
// lighter, bluer band above the page on a phone. Re-derive them if
// `--background` ever moves.
//
// The `media` conditions are the correct first paint, and only that: they answer
// the OS, while the product answers the stored preference. THEME_SCRIPT below
// re-points them once a viewer has chosen, so an installed scanner set to light
// on a dark phone does not keep a black bar above a white page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfdfe" },
    { media: "(prefers-color-scheme: dark)", color: "#090c11" },
  ],
};

// One owner for "which theme is on": first paint, a later OS change, another
// tab, and this tab's own switcher all arrive here. It shipped as a one-shot
// read of localStorage, which meant `system` was only ever system as of page
// load — a phone crossing into its night schedule mid-shift kept the day theme
// until the volunteer reloaded, and the address bar never moved at all.
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

// Shipped in the page source, so it is written for whoever opens view-source
// on the product — the design rules, not the story of how they were arrived at.
const DESIGN_CONTRACT = `<!--
EventPass design contract.

ONE VOICE: Geist Sans carries every heading, control, table cell and door
decision. There is no display face. Hierarchy is size, weight and spacing;
leading and letter-spacing are bound to each step of the type scale, never set
per element. The mono face is for ticket codes, web addresses and timestamps
only.

SURFACE: Near-monochrome neutrals, flat, separated by hairlines. One elevation
system. Unmodified shadcn primitives.

COLOUR IS STATE: Saturated colour appears only where the product is reporting
something — accepted, not yet confirmed, repeated, refused. Never decoration.
An offline yes never renders in the colour of a confirmed one.

TOKENS: Every colour, radius, weight and type size comes from globals.css.
No raw values, no per-component palettes.
-->`;

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
      <body className="flex min-h-full flex-col">
        <WebVitals />
        {/* The design contract, emitted as a real HTML comment. A JSX comment
            is a JavaScript comment: the compiler drops it, so it would document
            the source and leave the shipped page unauditable. */}
        <div hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }} />
        {children}
      </body>
    </html>
  );
}
