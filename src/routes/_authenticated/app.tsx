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
      <div className={hideNav ? "w-full max-w-[900px] mx-auto" : "max-w-[440px] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto"}>
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
