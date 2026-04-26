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
  title: "ORIGIN - Your Academic Hub",
  description: "Advanced learning platform for students and teachers.",
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
          defaultTheme="dark"
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

async function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const initialUser = await getServerFrontendUser();
  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
