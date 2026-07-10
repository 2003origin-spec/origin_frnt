/**
 * CBT teacher home (skeleton). The teacher shell + nav (Rooms, Tests,
 * Questions, Import) lands in Phase 3; this placeholder exists in Phase 1 so
 * the `/cbt` route tree is deployed and reachable on preview (defusing the
 * known new-route-404 gotcha) before feature work begins.
 */
export default function CbtHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="neu-raised rounded-3xl p-8">
        <h1 className="text-2xl font-black text-foreground">CBT</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The CBT teacher console is coming online.
        </p>
      </div>
    </main>
  );
}
