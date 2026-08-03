"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  X,
  Users,
  UserCheck,
  UserX,
  Mail,
  Loader2,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentProfilePanel } from "@/components/teacher/analytics/StudentProfilePanel";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiJson } from "@/lib/teacher-client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAGE_SIZE,
  formatPercent,
  formatStudyMinutes,
  initialsOf,
  scoreTone,
  type SortDirection,
  type StudentSortKey,
  TONE_TEXT,
} from "@/lib/teacher-analytics";
import type { BatchWithCounts, EnrollmentStatus, EnrollmentWithStudent } from "@/server/workspaces/types";
import { toast } from "sonner";

type BatchChip = { id: string; name: string };

type Props = {
  workspaceId: string;
  students: EnrollmentWithStudent[];
  batches: BatchWithCounts[];
  /** Real active batch memberships, keyed by student id. */
  batchesByStudent: Record<string, BatchChip[]>;
  canManage: boolean;
  /** Enables server-side search, performance columns, and the 360° profile. */
  deepAnalyticsEnabled: boolean;
};

type ActiveTab = "active" | "unassigned" | "suspended";

/** One directory row as returned by `GET …/students?directory=1`. */
type DirectoryRow = {
  studentId: string;
  name: string | null;
  email: string | null;
  studentClass: string | null;
  streak: number;
  totalStudyTimeMinutes: number;
  status: EnrollmentStatus;
  enrolledAt: string;
  batches: BatchChip[];
  meanPercentage: number | null;
  attempts: number;
  lastAttemptAt: string | null;
};

/** Enrollment statuses backing each directory tab. */
const TAB_STATUSES: Record<ActiveTab, EnrollmentStatus[]> = {
  active: ["active"],
  unassigned: ["unassigned"],
  // Two statuses, filtered server-side so pagination totals stay correct.
  suspended: ["suspended", "left"],
};

export function StudentsManagerHighFidelity({
  workspaceId,
  students,
  batches,
  batchesByStudent,
  canManage,
  deepAnalyticsEnabled,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  // Server-side directory state.
  const [sort, setSort] = useState<{ key: StudentSortKey; dir: SortDirection }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DirectoryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(deepAnalyticsEnabled);

  // Search-as-you-type without hammering the server: the query is debounced, and
  // a monotonically increasing token drops any response that arrives out of
  // order after a faster later keystroke (plan ledger #14).
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const requestToken = useRef(0);

  // Slide out Batch Allocator Drawer state
  const [allocatorOpen, setAllocatorOpen] = useState(false);
  const [allocatorBatches, setAllocatorBatches] = useState<Set<string>>(new Set());

  // Single action states
  const [pending, startTransition] = useTransition();
  const [invitePending, startInviteTransition] = useTransition();

  const tabCounts = {
    active: students.filter(s => s.status === "active").length,
    unassigned: students.filter(s => s.status === "unassigned").length,
    suspended: students.filter(s => s.status === "suspended" || s.status === "left").length,
  };

  const loadDirectory = useCallback(async () => {
    if (!deepAnalyticsEnabled) return;
    const token = ++requestToken.current;
    setLoadingRows(true);
    const params = new URLSearchParams({
      directory: "1",
      status: TAB_STATUSES[activeTab].join(","),
      sort: sort.key,
      dir: sort.dir,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (selectedBatchId !== "all") params.set("batchId", selectedBatchId);

    const result = await apiJson<{ rows: DirectoryRow[]; total: number }>(
      `/api/teacher/workspaces/${workspaceId}/students?${params.toString()}`,
    );
    // A stale response must never overwrite a newer one.
    if (token !== requestToken.current) return;
    if (result.ok) {
      setRows(result.data.rows ?? []);
      setTotal(result.data.total ?? 0);
    } else {
      setRows([]);
      setTotal(0);
    }
    setLoadingRows(false);
  }, [deepAnalyticsEnabled, workspaceId, activeTab, sort, page, debouncedQuery, selectedBatchId]);

  useEffect(() => {
    // Dispatch through a microtask (not a synchronously-invoked async fn) so the
    // effect body itself performs no synchronous state update — the same reason
    // AnalyticsCenterHighFidelity's loader is written as a .then() chain.
    void Promise.resolve().then(loadDirectory);
  }, [loadDirectory]);

  /**
   * Any filter change resets to page 1. Done in the handlers rather than in an
   * effect on the filter values: an effect would fire a request for the OLD page
   * first and a second one after the reset — two round trips per keystroke-pause.
   */
  const resetPage = () => setPage(1);

  /**
   * Fallback rows for when deep analytics is off: the same client-side filter as
   * before, but over REAL batch memberships. The simulated batch assignment and
   * hash-derived accuracy this table used to render are gone for good.
   */
  const fallbackRows = useMemo<DirectoryRow[]>(() => {
    if (deepAnalyticsEnabled) return [];
    const query = searchQuery.trim().toLowerCase();
    return students
      .filter((student) => {
        if (!TAB_STATUSES[activeTab].includes(student.status)) return false;
        if (query) {
          const haystack = [student.studentName, student.studentEmail, student.studentId]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (selectedBatchId !== "all") {
          const chips = batchesByStudent[student.studentId] ?? [];
          if (!chips.some((chip) => chip.id === selectedBatchId)) return false;
        }
        return true;
      })
      .map((student) => ({
        studentId: student.studentId,
        name: student.studentName,
        email: student.studentEmail,
        studentClass: null,
        streak: 0,
        totalStudyTimeMinutes: 0,
        status: student.status,
        enrolledAt: student.enrolledAt,
        batches: batchesByStudent[student.studentId] ?? [],
        meanPercentage: null,
        attempts: 0,
        lastAttemptAt: null,
      }));
  }, [deepAnalyticsEnabled, students, activeTab, searchQuery, selectedBatchId, batchesByStudent]);

  const visibleRows = deepAnalyticsEnabled ? (rows ?? []) : fallbackRows;
  const totalCount = deepAnalyticsEnabled ? total : fallbackRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === visibleRows.length && visibleRows.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(visibleRows.map(s => s.studentId)));
    }
  };

  const toggleAllocatorBatch = (batchId: string) => {
    setAllocatorBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  function toggleSort(key: StudentSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
    resetPage();
  }

  async function refreshAll() {
    await loadDirectory();
    router.refresh();
  }

  // Actions
  async function handleApprove(studentId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/students/${studentId}`,
        { method: "PATCH", json: { status: "active" } }
      );
      if (result.ok) {
        toast.success("Student registration approved!");
        await refreshAll();
      } else {
        toast.error(result.detail || "Failed to approve student");
      }
    });
  }

  async function handleSuspend(studentId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/students/${studentId}`,
        { method: "PATCH", json: { status: "suspended" } }
      );
      if (result.ok) {
        toast.success("Student suspended from workspace");
        await refreshAll();
      } else {
        toast.error(result.detail || "Failed to suspend student");
      }
    });
  }

  async function handleUnsuspend(studentId: string) {
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/students/${studentId}`,
        { method: "PATCH", json: { status: "active" } }
      );
      if (result.ok) {
        toast.success("Student access reinstated");
        await refreshAll();
      } else {
        toast.error(result.detail || "Failed to unsuspend student");
      }
    });
  }

  async function handleBulkAssign() {
    if (selectedStudentIds.size === 0 || allocatorBatches.size === 0) return;

    startTransition(async () => {
      let succeeded = 0;
      let failed = 0;

      // Loop over students and call assignment endpoint
      for (const studentId of Array.from(selectedStudentIds)) {
        const result = await apiJson(
          `/api/teacher/workspaces/${workspaceId}/students/${studentId}/assign-batches`,
          {
            method: "POST",
            json: { add: Array.from(allocatorBatches) }
          }
        );
        if (result.ok) succeeded++;
        else failed++;
      }

      if (failed === 0) {
        toast.success(`Successfully assigned ${succeeded} students to selected batches!`);
      } else {
        toast.warning(`Assigned ${succeeded} students, ${failed} failed.`);
      }

      setAllocatorOpen(false);
      setSelectedStudentIds(new Set());
      setAllocatorBatches(new Set());
      await refreshAll();
    });
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    startInviteTransition(async () => {
      // Simulate invite via join-code endpoint or manual invite
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/codes`,
        {
          method: "POST",
          json: { codeType: "student_join", rotate: false }
        }
      );

      if (result.ok) {
        toast.success(`Invite instructions created for ${inviteEmail}!`);
        setInviteOpen(false);
        setInviteEmail("");
      } else {
        toast.error("Failed to generate invite.");
      }
    });
  }

  return (
    <div className="space-y-6 relative">

      {/* DirectoryTabSwitcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 w-full">
        <div className="flex flex-wrap items-center gap-1 bg-muted/30 p-1 rounded-xl border overflow-x-auto max-w-full scrollbar-none shrink-0 w-full sm:w-auto">
          <Button
            variant={activeTab === "active" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab("active"); setSelectedStudentIds(new Set()); resetPage(); }}
            className={`rounded-lg h-9 px-4 shrink-0 whitespace-nowrap ${activeTab === "active" ? "bg-primary text-black font-semibold shadow-sm" : ""}`}
          >
            Active Directory ({tabCounts.active})
          </Button>
          <Button
            variant={activeTab === "unassigned" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab("unassigned"); setSelectedStudentIds(new Set()); resetPage(); }}
            className={`rounded-lg h-9 px-4 shrink-0 whitespace-nowrap ${activeTab === "unassigned" ? "bg-primary text-black font-semibold shadow-sm" : ""}`}
          >
            Onboarding Queue ({tabCounts.unassigned})
          </Button>
          <Button
            variant={activeTab === "suspended" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab("suspended"); setSelectedStudentIds(new Set()); resetPage(); }}
            className={`rounded-lg h-9 px-4 shrink-0 whitespace-nowrap ${activeTab === "suspended" ? "bg-primary text-black font-semibold shadow-sm" : ""}`}
          >
            Suspended/Left ({tabCounts.suspended})
          </Button>
        </div>

        {canManage && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-primary hover:bg-primary/95 text-black font-semibold gap-1.5 h-10 rounded-xl w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Manual Invite
          </Button>
        )}
      </div>

      {/* SearchFilterBar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            placeholder="Search students by name, email or ID..."
            aria-label="Search students"
            className="pl-10 h-10 rounded-xl border-border/80"
          />
          {deepAnalyticsEnabled && loadingRows && (
            <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedBatchId}
            onChange={(e) => { setSelectedBatchId(e.target.value); resetPage(); }}
            aria-label="Filter by batch"
            className="h-10 rounded-xl border border-border/80 bg-background px-3 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-48"
          >
            <option value="all">All Batches</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedStudentIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl flex items-center justify-between animate-slide-up">
          <span className="text-xs font-semibold text-primary">
            {selectedStudentIds.size} students selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setAllocatorOpen(true)}
              className="bg-primary text-black font-bold h-8 rounded-lg"
            >
              Assign Batches
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedStudentIds(new Set())}
              className="h-8 rounded-lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* StudentDirectoryTable */}
      <div className="border rounded-2xl overflow-hidden bg-card">
        {deepAnalyticsEnabled && loadingRows && rows === null ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No students found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {canManage && (
                    <th className="p-4 w-12 text-center">
                      <Checkbox
                        aria-label="Select all students on this page"
                        checked={selectedStudentIds.size === visibleRows.length && visibleRows.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <SortableHeader
                    label="Name"
                    sortKey="name"
                    active={sort}
                    onSort={toggleSort}
                    enabled={deepAnalyticsEnabled}
                    className="text-left"
                  />
                  <th className="p-4">Batches</th>
                  {deepAnalyticsEnabled && (
                    <>
                      <SortableHeader
                        label="Mean score"
                        sortKey="meanPercentage"
                        active={sort}
                        onSort={toggleSort}
                        enabled
                      />
                      <SortableHeader
                        label="Tests"
                        sortKey="attempts"
                        active={sort}
                        onSort={toggleSort}
                        enabled
                      />
                      <SortableHeader
                        label="Streak"
                        sortKey="streak"
                        active={sort}
                        onSort={toggleSort}
                        enabled
                      />
                    </>
                  )}
                  <SortableHeader
                    label="Enrolled"
                    sortKey="enrolledAt"
                    active={sort}
                    onSort={toggleSort}
                    enabled={deepAnalyticsEnabled}
                    className="text-left"
                  />
                  <th className="p-4">Status</th>
                  <th className="p-4 w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {visibleRows.map(student => (
                  <tr
                    key={student.studentId}
                    onClick={
                      deepAnalyticsEnabled ? () => setOpenStudentId(student.studentId) : undefined
                    }
                    className={cn(
                      "transition-colors hover:bg-muted/10",
                      deepAnalyticsEnabled && "cursor-pointer",
                    )}
                  >
                    {canManage && (
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`Select ${student.name || student.studentId}`}
                          checked={selectedStudentIds.has(student.studentId)}
                          onCheckedChange={() => toggleSelectStudent(student.studentId)}
                        />
                      </td>
                    )}
                    <td className="p-4 font-medium min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.65rem] font-bold text-primary"
                        >
                          {initialsOf(student.name)}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{student.name || student.studentId}</span>
                          <span className="text-xs text-muted-foreground font-normal truncate">
                            {student.email || "—"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {student.batches.map(b => (
                          <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                            {b.name}
                          </span>
                        ))}
                        {student.batches.length === 0 && (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                    </td>
                    {deepAnalyticsEnabled && (
                      <>
                        <td className="p-4 text-center">
                          <span
                            className={cn(
                              "font-mono text-sm font-bold tabular-nums",
                              TONE_TEXT[scoreTone(student.meanPercentage)],
                            )}
                          >
                            {formatPercent(student.meanPercentage, 1)}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-xs tabular-nums text-muted-foreground">
                          {student.attempts}
                        </td>
                        <td className="p-4 text-center text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Flame aria-hidden="true" className="size-3" />
                            {student.streak}d
                          </span>
                          <span className="block text-[10px]">
                            {formatStudyMinutes(student.totalStudyTimeMinutes)}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(student.enrolledAt).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        student.status === "active"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : student.status === "unassigned"
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-destructive/15 text-destructive"
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="w-4 h-4" />
                            <span className="sr-only">Actions for {student.name || student.studentId}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          {deepAnalyticsEnabled && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setOpenStudentId(student.studentId)}
                                className="gap-2 font-medium"
                              >
                                <Users className="w-4 h-4 text-primary" /> View full profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {student.status === "unassigned" && (
                            <DropdownMenuItem onClick={() => handleApprove(student.studentId)} className="gap-2 font-medium">
                              <UserCheck className="w-4 h-4 text-emerald-500" /> Approve Registration
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setSelectedStudentIds(new Set([student.studentId]));
                            setAllocatorOpen(true);
                          }} className="gap-2">
                            Assign Batches
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {student.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => handleUnsuspend(student.studentId)} className="gap-2 text-emerald-600 dark:text-emerald-400">
                              <Unlock className="w-4 h-4" /> Reactivate Student
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSuspend(student.studentId)} className="gap-2 text-destructive">
                              <UserX className="w-4 h-4" /> Suspend Student
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination — server-paged, so a large institute never ships one huge page. */}
      {deepAnalyticsEnabled && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * DEFAULT_PAGE_SIZE + 1}–
            {Math.min(page * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loadingRows}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-lg gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <span className="font-semibold">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loadingRows}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-lg gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* BatchAllocatorDrawer Slide-out Panel Overlay */}
      <AnimatePresence>
        {allocatorOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setAllocatorOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-background border-l z-50 p-6 flex flex-col justify-between shadow-lg shadow-black/5"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="font-bold text-lg">Batch Allocator</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Allocate {selectedStudentIds.size} selected students
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setAllocatorOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                    <span className="sr-only">Close batch allocator</span>
                  </Button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {batches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active batches available.</p>
                  ) : (
                    batches.map((batch) => (
                      <label
                        key={batch.id}
                        className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                          allocatorBatches.has(batch.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={allocatorBatches.has(batch.id)}
                          onCheckedChange={() => toggleAllocatorBatch(batch.id)}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{batch.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {batch.course || "General"} · {batch.studentCount} students
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <Button
                  disabled={pending || allocatorBatches.size === 0}
                  onClick={handleBulkAssign}
                  className="w-full bg-primary hover:bg-primary/95 text-black font-bold h-11 rounded-xl gap-2"
                >
                  {pending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    `Assign Batches (${allocatorBatches.size} Selected)`
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAllocatorOpen(false)}
                  className="w-full h-11 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Manual Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Manual Student Invite</DialogTitle>
            <DialogDescription>
              Invite a student directly to this workspace by typing their email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Student Email Address</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="rounded-xl flex-1">
              Cancel
            </Button>
            <Button
              onClick={sendInvite}
              disabled={invitePending || !inviteEmail.trim()}
              className="bg-primary hover:bg-primary/95 text-black font-bold rounded-xl flex-1 gap-1.5"
            >
              {invitePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deepAnalyticsEnabled && (
        <StudentProfilePanel
          workspaceId={workspaceId}
          studentId={openStudentId}
          onClose={() => setOpenStudentId(null)}
        />
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  active,
  onSort,
  enabled,
  className,
}: {
  label: string;
  sortKey: StudentSortKey;
  active: { key: StudentSortKey; dir: SortDirection };
  onSort: (key: StudentSortKey) => void;
  enabled: boolean;
  className?: string;
}) {
  if (!enabled) {
    return <th className={cn("p-4", className)}>{label}</th>;
  }
  const isActive = active.key === sortKey;
  return (
    <th
      scope="col"
      className={cn("p-4 text-center", className)}
      aria-sort={isActive ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          isActive && "text-foreground",
        )}
      >
        {label}
        <span aria-hidden="true" className={cn("text-[0.6rem]", !isActive && "opacity-40")}>
          {isActive && active.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
