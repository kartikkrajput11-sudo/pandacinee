import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import PartnerMessageNotifier from "@/components/PartnerMessageNotifier";
import OwnersMonthiversary from "@/components/OwnersMonthiversary";
import PairAnniversaryCelebration from "@/components/PairAnniversaryCelebration";
import { BroadcastListener } from "@/components/BroadcastListener";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl italic text-petal">404</h1>
        <h2 className="mt-4 text-xl font-medium text-candle">This page wandered off</h2>
        <p className="mt-2 text-sm text-candle-muted">
          The panda couldn't find what you're looking for.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-petal px-6 py-3 text-sm font-semibold text-velvet transition-all hover:brightness-110"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl italic text-candle">Something dimmed the lights</h1>
        <p className="mt-2 text-sm text-candle-muted">
          Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-petal px-6 py-3 text-sm font-semibold text-velvet"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium text-candle"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PANDACINE — Never ending Love" },
      {
        name: "description",
        content:
          "Watch movies, chat, and create memories with your partner. PANDACINE is the cozy app made for the two of you.",
      },
      { name: "theme-color", content: "#1f0f24" },
      { property: "og:title", content: "PANDACINE — Never ending Love" },
      {
        property: "og:description",
        content: "A private digital living room designed for two. Watch. Chat. Connect.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PANDACINE — Never ending Love" },
      { name: "description", content: "Panda Love Cinema is a cozy app for couples to watch movies, play games, and connect." },
      { property: "og:description", content: "Panda Love Cinema is a cozy app for couples to watch movies, play games, and connect." },
      { name: "twitter:description", content: "Panda Love Cinema is a cozy app for couples to watch movies, play games, and connect." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7dfe4062-8e6e-4bf0-becc-4a042ef1a047/id-preview-e2f08ce3--25270c29-07a4-4330-b880-59d2d9d53167.lovable.app-1781760079051.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7dfe4062-8e6e-4bf0-becc-4a042ef1a047/id-preview-e2f08ce3--25270c29-07a4-4330-b880-59d2d9d53167.lovable.app-1781760079051.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=Outfit:wght@300;400;500;600;700&display=swap",
      },

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouteFadeOutlet />

        <PartnerMessageNotifier />
        <OwnersMonthiversary />
        <PairAnniversaryCelebration />
        <BroadcastListener />
        
        <Toaster
          theme="dark"
          position="top-center"
          expand
          visibleToasts={4}
          gap={12}
          offset={20}
          toastOptions={{
            duration: 4200,
            className: "lux-toast",
            unstyled: false,
          }}
        />

      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RouteFadeOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="animate-route-fade">
      <Outlet />
    </div>
  );
}

