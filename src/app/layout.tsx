import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Darker_Grotesque } from "next/font/google";
import "./globals.css";
import AgentationLoader from "@/components/layout/AgentationLoader";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ClientShell from "@/components/layout/ClientShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { WebVitals } from "@/components/seo/WebVitals";
import ServiceWorkerManager from "@/components/pwa/ServiceWorkerManager";
import { QuotaProvider } from "@/context/QuotaContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerFrontendUser } from "@/lib/auth-server";
import { getLaunchSettings, isCoverActive } from "@/server/launch-settings";
import { resolveAiAccessForUser } from "@/server/ai-access";
import { AiAccessProvider } from "@/context/AiAccessContext";

// Single typeface per brand spec: Darker Grotesque (Regular 400, SemiBold 600, Bold 700+)
// Wordmark → 700-900, Headlines & Taglines → 600, Body → 400-500
const darkerGrotesque = Darker_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-grotesque",
  display: "swap",
});

const siteUrl = getCanonicalSiteUrl();

// Sitewide structured data: who we are (knowledge panel / LLM extraction) and
// the site entity. No SearchAction — there is no public search page (OGCode is
// auth-gated), so advertising one would be misleading.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "O3 Origin",
  alternateName: "ORIGIN AI",
  url: siteUrl,
  logo: `${siteUrl}/origin-new.jpg`,
  image: `${siteUrl}/origin-new.jpg`,
  description:
    "AI-powered learning platform for JEE, NEET and Foundation — diagnoses where a student is going wrong and teaches the fix. Built by SUPERGOAT TECHNOLOGIES PRIVATE LIMITED.",
  foundingLocation: { "@type": "Place", name: "Agartala, Tripura, India" },
  sameAs: [
    "https://www.instagram.com/o3.origin/",
    "https://www.linkedin.com/in/o3-origin-ba73233a8/",
  ],
};
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "O3 Origin",
  alternateName: "ORIGIN AI",
  url: siteUrl,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
  description: "The most advanced AI-powered learning platform for JEE, NEET, and Foundation. Personalized guidance, infinite practice, and 24/7 AI mentoring.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
    description: "Personalized guidance, infinite practice, and 24/7 AI mentoring for JEE and NEET scholars.",
    url: siteUrl,
    siteName: "ORIGIN AI",
    images: [
      {
        url: "/origin-new.jpg",
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
    images: ["/origin-new.jpg"],
  },
  // Google Search Console verification (meta-tag method). Baked in so it ships
  // without env config; env can override. A second proof (the HTML file at
  // /google04973042719594b9.html in public/) is also served — Google needs
  // only one, this is belt-and-suspenders.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "FLL64KPBN8ThzJs6_foY6ElQNXr52ND6iOU0Bqghcjg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const connectEnabled = isFeatureEnabled("teacherConnect");
  const premiumEnabled = isFeatureEnabled("premiumSubscriptions");
  const socialEnabled = isFeatureEnabled("studentSocial");
  // Pre-launch cover: server-computed so there is no flash of the real site.
  const launch = await getLaunchSettings().catch(() => null);
  const coverActive = launch ? isCoverActive(launch) : false;
  const launchAt = launch?.launchAt ?? null;
  // Seed the client AuthProvider with the server-resolved user so the client
  // skips the /api/users/me waterfall on every page load.
  const initialUser = await getServerFrontendUser().catch(() => null);
  // AI Feature Toggle epic — seed the client provider from the server-resolved
  // decision so the AI surfaces don't flash before the first poll (doc 06 §1.1).
  const initialAiAccess = initialUser
    ? await resolveAiAccessForUser({ id: initialUser.id, role: initialUser.role })
    : { originAi: false, aiExplainer: false };
  return (
    <html lang="en" suppressHydrationWarning className={darkerGrotesque.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
        <WebVitals />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <AuthProvider initialUser={initialUser}>
              <NotificationProvider>
                <QuotaProvider>
                  <AiAccessProvider initial={{ originAi: initialAiAccess.originAi, aiExplainer: initialAiAccess.aiExplainer }}>
                    <ClientShell connectEnabled={connectEnabled} premiumEnabled={premiumEnabled} socialEnabled={socialEnabled} coverActive={coverActive} launchAt={launchAt}>{children}</ClientShell>
                  </AiAccessProvider>
                </QuotaProvider>
              </NotificationProvider>
            </AuthProvider>
          </Suspense>
          <Toaster position="top-right" richColors />
          {/* Offline layer: SW registration + kill switch + deploy-skew
              recovery for all users (ANDROID_HYBRID_APP_PLAN.md §6). */}
          <ServiceWorkerManager />
          {process.env.NODE_ENV === "development" && <AgentationLoader />}
        </ThemeProvider>
        {/* GA4 (Origin Web, G-NGH8J3E2D0). Uses NEXT_PUBLIC_GA_ID if set (any
            env — handy for testing on a preview), otherwise falls back to the
            known Measurement ID ONLY on the Vercel production deployment — so
            dev/preview traffic never pollutes analytics. Enhanced Measurement
            (on by default in GA4) captures SPA route-change page_views. Fires in
            the Android shell too, since it loads the production site. */}
        {(() => {
          const gaId =
            process.env.NEXT_PUBLIC_GA_ID ||
            (process.env.VERCEL_ENV === "production" ? "G-NGH8J3E2D0" : "");
          return gaId ? <GoogleAnalytics gaId={gaId} /> : null;
        })()}
      </body>
    </html>
  );
}
