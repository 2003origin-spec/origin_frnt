import type { Metadata } from "next";

// The FAQ page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "FAQ — ORIGIN AI for JEE & NEET",
  description:
    "Answers about O3 Origin: what it is, how the AI diagnoses weak areas, pricing, device support, and who built it. AI-powered JEE & NEET preparation.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ — ORIGIN AI",
    description: "Common questions about O3 Origin, the AI JEE & NEET preparation platform.",
    url: "/faq",
    type: "website",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
