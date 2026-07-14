import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const { pathname } = useLocation();
  // Hide bottom nav on chat conversations and calls (it overlaps the composer / call UI)
  const hideNav =
    /^\/app\/chat\/[^/]+/.test(pathname) ||
    /^\/app\/call\/[^/]+/.test(pathname);

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
