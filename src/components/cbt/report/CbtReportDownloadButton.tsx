"use client";

/**
 * One-click PDF of the report card.
 *
 * `jspdf` is imported dynamically so its ~350 KB never enters any other bundle
 * — this button is the only thing in the app that needs it, and it is on a
 * public page students open on cheap phones.
 *
 * The capture is deliberately sliced: each report section is rasterised on its
 * own and paginated, rather than snapshotting the whole document into one
 * canvas. A 90-question answer sheet in one canvas is tens of megapixels and
 * reliably OOMs a low-end Android browser.
 *
 * There is always a second path: if capture throws for any reason, the button
 * falls back to `window.print()`, which the print stylesheet is set up for.
 */

import { useCallback, useState, type RefObject } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveFileNative } from "@/native/save-file";
import type { CbtReportCard } from "@/server/cbt/cbt-report-service";

/** A4 at 96 dpi, in CSS pixels. */
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const PAGE_MARGIN_PX = 28;

function fileNameFor(report: CbtReportCard): string {
  const code = (report.student.studentCode || "report").replace(/[^A-Za-z0-9-]/g, "");
  const test = (report.test.title || "test")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `origin-report-${code}${test ? `-${test}` : ""}.pdf`;
}

export function CbtReportDownloadButton({
  targetRef,
  report,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
  report: CbtReportCard;
}) {
  const [busy, setBusy] = useState(false);

  const download = useCallback(async () => {
    const node = targetRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const [{ toPng }, jsPdfModule] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const JsPDF = jsPdfModule.jsPDF;

      // KaTeX and the logo/diagram images must be painted before the snapshot,
      // or the PDF comes out with blank formulae and missing figures.
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const sections = Array.from(node.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );
      if (sections.length === 0) throw new Error("Nothing to capture.");

      const pdf = new JsPDF({ unit: "px", format: [PAGE_WIDTH_PX, PAGE_HEIGHT_PX], compress: true });
      const contentWidth = PAGE_WIDTH_PX - PAGE_MARGIN_PX * 2;
      let cursorY = PAGE_MARGIN_PX;
      let firstPage = true;

      for (const section of sections) {
        const dataUrl = await toPng(section, {
          pixelRatio: 2,
          cacheBust: true,
          // The PDF is printed on white paper; capturing a dark-mode report
          // would produce a page flooded with black ink.
          backgroundColor: "#ffffff",
          style: { colorScheme: "light" },
        });

        const scaled = contentWidth / section.offsetWidth;
        const drawHeight = section.offsetHeight * scaled;

        // A section taller than a full page starts its own page and is allowed
        // to overflow rather than being cut mid-row.
        if (!firstPage && cursorY + drawHeight > PAGE_HEIGHT_PX - PAGE_MARGIN_PX) {
          pdf.addPage();
          cursorY = PAGE_MARGIN_PX;
        }
        pdf.addImage(dataUrl, "PNG", PAGE_MARGIN_PX, cursorY, contentWidth, drawHeight, undefined, "FAST");
        cursorY += drawHeight + 12;
        firstPage = false;
      }

      const fileName = fileNameFor(report);
      const blob = pdf.output("blob") as Blob;
      // Inside the Android shell a blob download silently does nothing, so the
      // bridge takes it when it can; browsers fall through to the normal save.
      if (await saveFileNative(fileName, "application/pdf", blob)) return;
      pdf.save(fileName);
    } catch (error) {
      console.error("[cbt-report] PDF export failed", error);
      toast.error("Couldn't build the PDF — opening the print dialog instead.");
      window.print();
    } finally {
      setBusy(false);
    }
  }, [busy, report, targetRef]);

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => window.print()} title="Print or save as PDF">
        <Printer className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">Print</span>
      </Button>
      <Button size="sm" onClick={() => void download()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span className="ml-1.5">{busy ? "Building…" : "Download PDF"}</span>
      </Button>
    </div>
  );
}
