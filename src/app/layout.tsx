import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ClientShell from "@/components/layout/ClientShell";
import { getServerFrontendUser } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
  description: "The most advanced AI-powered learning platform for JEE, NEET, and Foundation. Personalized guidance, infinite practice, and 24/7 AI mentoring.",
  openGraph: {
    title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
    description: "Personalized guidance, infinite practice, and 24/7 AI mentoring for JEE and NEET scholars.",
    url: "https://origin-ai.vercel.app",
    siteName: "ORIGIN AI",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ORIGIN AI - Best Prep Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
    description: "The most advanced AI-powered learning platform for JEE, NEET, and Foundation.",
    images: ["/og-image.jpg"],
  },
};

/**
 * Root layout is a synchronous shell so the static HTML can be prerendered
 * under `cacheComponents: true`. The cookie read + AuthProvider bootstrap
 * lives inside a Suspense child so the shell can stream before the user is
 * resolved. `cookies()` is local and fast, so the fallback tree rarely
 * shows in practice — but having it as a proper boundary is what Cache
 * Components requires.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <AuthBootstrap>
              <ClientShell>{children}</ClientShell>
            </AuthBootstrap>
          </Suspense>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

import { NotificationProvider } from "@/context/NotificationContext";

async function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const initialUser = await getServerFrontendUser();
  return (
    <AuthProvider initialUser={initialUser}>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </AuthProvider>
  );
}
