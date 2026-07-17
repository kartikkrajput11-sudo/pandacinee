import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useGamePresence } from "@/hooks/useGamePresence";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  usePresenceHeartbeat();
  const { data } = useProfile();
  useGamePresence(data?.profile?.id, data?.partner?.id);
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
      {/* Keep nav mounted so it doesn't flash in before the home content on return */}
      <div
        aria-hidden={hideNav}
        className={`transition-opacity duration-200 ${hideNav ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <BottomNav />
      </div>
    </div>
  );
}
