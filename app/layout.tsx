import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Ticket Codes, identifiers, timestamps, and every operational number. Plex
// keeps 5/S, 2/Z, 8/B, and 6/G apart, which is all the Crockford Base32
// alphabet still asks for once I, L, O, and U are excluded.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Display only — page titles, public pages, landing headlines, the Event name
// on a Ticket. Never operational text. It ships regular and italic alone, and
// that constraint is the point: it cannot leak into UI without looking wrong.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventpass.hetjethva.tech";
const siteDescription =
  "Trustworthy Event registration and admission operations, with a scanner that keeps working when venue internet does not.";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${geistSans.variable} ${plexMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('eventpass-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
