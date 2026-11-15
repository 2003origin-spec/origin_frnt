export const dynamic = "force-dynamic";

import { MusicConsole } from "@/components/admin/music/MusicConsole";

/**
 * /admin/music — Study Music: upload licensed focus-music tracks, publish,
 * retire and delete them (V1/STUDY_MUSIC_PLAN.md §4.7). The admin layout
 * already requires the admin role; every data call goes through
 * /api/admin/music/*, which checks it again. Not behind the studyMusic flag, so
 * founders can upload while students can't see anything yet.
 */
export default function AdminMusicPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BoomBoom</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          BoomBoom is ad-free focus music for students on the website and the app. Every track needs its licence, source and credit
          before it can be published.
        </p>
      </div>
      <MusicConsole />
    </div>
  );
}
