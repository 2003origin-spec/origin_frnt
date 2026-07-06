/**
 * CBT teacher home (skeleton). The teacher shell + nav (Rooms, Tests,
 * Questions, Import) lands in Phase 3; this placeholder exists in Phase 1 so
 * the `/cbt` route tree is deployed and reachable on preview (defusing the
 * known new-route-404 gotcha) before feature work begins.
 */
export default function CbtHomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">CBT</h1>
      <p className="text-sm text-muted-foreground">
        The CBT teacher console is coming online.
      </p>
    </main>
  );
}
