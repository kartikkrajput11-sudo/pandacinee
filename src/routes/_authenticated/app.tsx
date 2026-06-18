import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  return (
    <div className="min-h-screen velvet-bg pb-28">
      <IncomingCallListener />
      <div className="max-w-[440px] mx-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
