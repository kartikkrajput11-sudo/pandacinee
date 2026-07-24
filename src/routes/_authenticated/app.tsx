import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { AppTour } from "@/components/AppTour";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useGamePresence } from "@/hooks/useGamePresence";
import { useProfile } from "@/hooks/useProfile";
import { useScheduledDispatcher } from "@/hooks/useScheduledDispatcher";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  usePresenceHeartbeat();
  const { data } = useProfile();
  useGamePresence(data?.profile?.id, data?.partner?.id);
  useScheduledDispatcher(data?.profile?.id);
  const { pathname } = useLocation();
  // Only show bottom nav on the home page; every other page has its own back button
  const hideNav = pathname !== "/app";

  // Global guided tour lives here so it survives navigation between pages.
  // Opens ONLY via the "Walk-through" button in Settings (or Home) — never auto.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setTourOpen(true);
    window.addEventListener("pandacine:open-tour", onOpen);
    return () => window.removeEventListener("pandacine:open-tour", onOpen);
  }, []);


  return (
    <div className={`relative min-h-screen velvet-bg ${hideNav ? "" : "pb-28"}`}>
      {/* Aubergine editorial vignette — subtle coral bloom + top hairline */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, color-mix(in oklab, var(--petal) 10%, transparent) 0%, transparent 70%), radial-gradient(50% 40% at 100% 100%, color-mix(in oklab, var(--lavender) 8%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 inset-x-0 h-px z-[1] bg-gradient-to-r from-transparent via-petal/50 to-transparent"
      />
      <OnboardingFlow />
      <IncomingCallListener />
      <div className="relative z-[2] w-full max-w-[1400px] mx-auto">
        <Outlet />
      </div>
      {/* Keep nav mounted so it doesn't flash in before the home content on return */}
      <div
        aria-hidden={hideNav}
        className={`transition-opacity duration-200 ${hideNav ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <BottomNav />
      </div>
      <AppTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
