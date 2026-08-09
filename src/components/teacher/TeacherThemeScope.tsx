"use client";

import { useEffect } from "react";

/**
 * Extends the teacher "data-terminal" theme scope to <html> while any teacher
 * route is mounted, so portalled UI (Radix dialogs, dropdowns, popovers, toasts,
 * tooltips) — which render on <body>, outside the teacher page tree — inherit the
 * same `.theme-teacher` tokens as the page. Removed on unmount so student/CBT
 * routes fall back to the default palette. Page content itself is already themed
 * server-side via the class on the layout wrapper, so this only covers portals
 * and never causes a content flash.
 */
export function TeacherThemeScope() {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("theme-teacher");
    return () => el.classList.remove("theme-teacher");
  }, []);
  return null;
}
