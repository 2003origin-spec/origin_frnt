import { ncertBooksData } from "@/data/ncertBooks";

/** One NCERT book for the app: chapters carry the site path of their PDF. */
export type AppBook = {
  id: string;
  title: string;
  bookClass: string;
  subject: "physics" | "chemistry" | "mathematics" | "biology";
  chapters: { id: string; title: string; path: string }[];
};

const SUBJECTS: Record<string, AppBook["subject"]> = {
  Physics: "physics",
  Chemistry: "chemistry",
  Mathematics: "mathematics",
  Biology: "biology",
};

/**
 * The website's Study Corner NCERT catalogue (src/data/ncertBooks.ts), with
 * each chapter's PDF path under /books (served behind sign-in; the app sends
 * its Bearer token). Path segments are URL-encoded ("Chapter 1.pdf").
 */
export function appBooks(): AppBook[] {
  return ncertBooksData
    .filter((b) => b.basePath && SUBJECTS[b.subject])
    .map((b) => ({
      id: b.id,
      title: b.title,
      bookClass: b.bookClass,
      subject: SUBJECTS[b.subject],
      chapters: (b.chapters ?? [])
        .filter((c) => c.pdfFile)
        .map((c) => ({
          id: c.id,
          title: c.title,
          path: `/books/${[...b.basePath!.split("/"), c.pdfFile!].map(encodeURIComponent).join("/")}`,
        })),
    }));
}
