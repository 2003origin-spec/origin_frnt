import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ClientShell from "@/components/layout/ClientShell";


export const metadata: Metadata = {
  title: "ORIGIN - Your Academic Hub",
  description: "Advanced learning platform for students and teachers.",
};

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
          <AuthProvider>
            <ClientShell>
              {children}
            </ClientShell>
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
