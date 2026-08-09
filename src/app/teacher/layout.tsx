import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { TeacherThemeScope } from "@/components/teacher/TeacherThemeScope";

export default async function TeacherShellLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabled("workspaces")) {
    redirect("/dashboard");
  }
  const user = await getServerUser();
  if (!user) {
    redirect("/auth?next=/teacher");
  }
  if (user.role !== "teacher" && user.role !== "admin") {
    redirect("/dashboard");
  }
  // `theme-teacher` scopes the data-terminal palette to the teacher subtree
  // (student + CBT never get it). The wrapper class themes page content
  // server-side (no flash); TeacherThemeScope extends it to <html> so portalled
  // dialogs/dropdowns/toasts inherit the same tokens.
  return (
    <div className="theme-teacher min-h-dvh bg-background">
      <TeacherThemeScope />
      {children}
    </div>
  );
}
