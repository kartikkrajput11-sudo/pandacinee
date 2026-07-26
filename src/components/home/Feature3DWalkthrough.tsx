import { lazy, Suspense } from "react";

const LazyScene = lazy(() =>
  import("./Feature3DWalkthroughScene").then((m) => ({ default: m.Feature3DWalkthroughScene })),
);

const SCENES = [
  {
    eyebrow: "Chapter I",
    title: "Chat like you're touching",
    body: "Kisses, hugs, nudges, headpats — every gesture animates on both screens in real time.",
  },
  {
    eyebrow: "Chapter II",
    title: "Panda stickers & reactions",
    body: "Long-press to react, double-tap to like, drop a panda sticker mid-sentence.",
  },
  {
    eyebrow: "Chapter III",
    title: "Voice notes & shared media",
    body: "Whisper a voice note, share a photo, view-once memories that fade after one glance.",
  },
  {
    eyebrow: "Chapter IV",
    title: "Movie nights, perfectly synced",
    body: "Host controls play, pause, seek — followers stay locked to the second across servers.",
  },
  {
    eyebrow: "Chapter V",
    title: "Play together, always",
    body: "Uno, Chess, Ludo, 8-Ball, Hide & Seek, Know-Me — invite your person or a whole group.",
  },
  {
    eyebrow: "Chapter VI",
    title: "Group rooms & polls",
    body: "Velvet group chats, custom themes, voice notes, and polls that feel like couture.",
  },
  {
    eyebrow: "Chapter VII",
    title: "Milestones worth celebrating",
    body: "7 days, 100, 365 — cinematic anniversary animations rain across both screens.",
  },
  {
    eyebrow: "Chapter VIII",
    title: "Notifications that find you",
    body: "A soft slide-in from the right whenever your panda writes — no matter where you are.",
  },
];

export function Feature3DWalkthrough() {
  return (
    <section
      className="relative z-10 -mx-5 mt-4 overflow-hidden rounded-none border-y border-petal/15 bg-gradient-to-b from-velvet via-background to-velvet"
      aria-label="Feature walkthrough"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-velvet to-transparent z-20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-velvet to-transparent z-20" />

      <div className="relative" data-walkthrough-root style={{ height: `${SCENES.length * 100}vh` }}>
        {/* Sticky 3D canvas */}
        <div className="sticky top-0 h-screen w-full">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.3em] text-candle-muted">
                Loading walkthrough…
              </div>
            }
          >
            <LazyScene sceneCount={SCENES.length} />
          </Suspense>

          {/* Progress rail */}
          <div className="pointer-events-none absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
            {SCENES.map((_, i) => (
              <span
                key={i}
                className="h-6 w-[2px] rounded-full bg-petal/25"
                data-idx={i}
              />
            ))}
          </div>
        </div>

        {/* Scroll-driven text slides overlaid on top of the sticky canvas */}
        <div className="absolute inset-0 z-30">
          {SCENES.map((scene, i) => (
            <div
              key={i}
              className="flex h-screen w-full items-end sm:items-center"
              style={{ position: "absolute", top: `${i * 100}vh`, left: 0 }}
            >
              <div className={`w-full px-6 pb-24 sm:pb-0 ${i % 2 === 0 ? "sm:pl-12 sm:text-left" : "sm:pr-12 sm:text-right sm:ml-auto"}`}>
                <div className={`max-w-md ${i % 2 === 0 ? "" : "sm:ml-auto"}`}>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-petal">✦ {scene.eyebrow}</p>
                  <h3 className="mt-2 font-serif text-3xl italic leading-tight text-candle sm:text-5xl">
                    {scene.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-candle-muted sm:text-base">
                    {scene.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
