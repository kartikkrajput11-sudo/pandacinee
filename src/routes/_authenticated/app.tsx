import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  usePresenceHeartbeat();
  const { pathname } = useLocation();
  // Only show bottom nav on the home page; every other page has its own back button
  const hideNav = pathname !== "/app";

  return (
    <div className={`min-h-screen velvet-bg ${hideNav ? "" : "pb-28"}`}>
      <OnboardingFlow />
      <IncomingCallListener />
      <div className="w-full max-w-[1400px] mx-auto">
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
