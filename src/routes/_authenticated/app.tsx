import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  return (
    <div className="min-h-screen velvet-bg pb-28">
      <OnboardingFlow />
      <IncomingCallListener />
      <div className="max-w-[440px] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
