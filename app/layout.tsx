import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
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
