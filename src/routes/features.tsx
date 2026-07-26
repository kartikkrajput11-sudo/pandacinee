import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ScrollGlobe from "@/components/ui/landing-page";

export const Route = createFileRoute("/features")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PANDACINE — Every Feature, One Velvet Room" },
      {
        name: "description",
        content:
          "Scroll through every Pandacine feature — synced movies, luxury chat, panda gestures, games, groups, and milestones — in an interactive globe walkthrough.",
      },
      { property: "og:title", content: "PANDACINE — Every Feature, One Velvet Room" },
      {
        property: "og:description",
        content:
          "A scroll-powered tour of Pandacine: chat, kiss & hug gestures, synced cinema, luxury games, groups, and anniversary milestones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  const navigate = useNavigate();

  const sections = [
    {
      id: "hero",
      badge: "Pandacine",
      title: "A cinema",
      subtitle: "built for two",
      description:
        "Pandacine is a private velvet room where couples watch, chat, play and remember together. Scroll to explore every feature.",
      align: "left" as const,
      actions: [
        { label: "Enter the room", variant: "primary" as const, onClick: () => navigate({ to: "/app" }) },
        { label: "Sign in", variant: "secondary" as const, onClick: () => navigate({ to: "/auth" }) },
      ],
    },
    {
      id: "chat",
      badge: "Chat & Gestures",
      title: "Chat that feels",
      subtitle: "like being held",
      description:
        "Long-press for reactions, double-tap to like, forward messages with media, voice notes, and view-once photos. Every interaction is designed to feel intimate.",
      align: "center" as const,
      features: [
        { title: "Panda gestures", description: "Kiss, hug, headpat, nudge, boop and handhold — full-screen animations delivered in real time." },
        { title: "Shared media drawer", description: "Photos, videos, voice notes and files, all in one velvet gallery you both curate." },
        { title: "Long-press context", description: "Instagram-style hold for reactions, reply, forward, pin — with cinematic blur." },
      ],
    },
    {
      id: "cinema",
      badge: "Synced Cinema",
      title: "Watch in",
      subtitle: "lock-step",
      description:
        "Movies and shows sync automatically between both of you. Multiple mirror servers, host-follower locks, party chat, and post-movie reflections.",
      align: "left" as const,
      features: [
        { title: "Panda Stream HD & Mirrors", description: "Instant playback with Twin Reel, Rose Cinema, Moonlit Reel and Pandacine's own uploads." },
        { title: "Auto-follow sync", description: "Follower auto-loads and joins the exact frame — no counting to three." },
        { title: "Watch party chat", description: "Whisper during the movie without ever leaving the screen." },
      ],
    },
    {
      id: "play",
      badge: "Games",
      title: "Play",
      subtitle: "together",
      description:
        "Chess with drag-capture blood spots, Uno with rose-gold glow, Ludo, 8-Ball, Hide & Seek, Trivia, Love Quiz, How-Well-Do-You-Know-Me and more — all with in-game chat.",
      align: "center" as const,
      features: [
        { title: "Duel + Observer", description: "In group games, two duel while the rest cheer from an observer chat." },
        { title: "Friend invites", description: "Send any game to a friend or partner — a room opens and the match begins on arrival." },
        { title: "Rotating AI questions", description: "50 fresh questions per session for Trivia, Love Quiz, Truth or Dare and Would You Rather." },
      ],
    },
    {
      id: "groups",
      badge: "Groups",
      title: "Rooms",
      subtitle: "for your circle",
      description:
        "Join by code, theme your room, share polls with luxury voting cards, run group games with dynamic seats, and celebrate together.",
      align: "left" as const,
      features: [
        { title: "Luxury polls", description: "Velvet voting cards with real-time results everyone can feel." },
        { title: "Voice notes", description: "Whisper into the room instead of typing when words aren't enough." },
        { title: "Custom themes", description: "Backgrounds, colours and codes that make each room unmistakably yours." },
      ],
    },
    {
      id: "milestones",
      badge: "Milestones",
      title: "Every day",
      subtitle: "worth remembering",
      description:
        "Anniversary countdowns, monthiversary banners, streaks, letters sealed for later, constellations, love timelines and a memory-of-the-day — Pandacine keeps the story.",
      align: "center" as const,
      features: [
        { title: "Sealed love letters", description: "Write today, deliver on a future date. Wax seal, velvet envelope." },
        { title: "Milestone animations", description: "Cinematic celebrations at 7, 100, 150, 200, 300 and 365 days." },
        { title: "Constellation & timeline", description: "Your shared night sky and the highlights of us, always one tap away." },
      ],
      actions: [
        { label: "Open your room", variant: "primary" as const, onClick: () => navigate({ to: "/app" }) },
        { label: "Start a tour", variant: "secondary" as const, onClick: () => navigate({ to: "/app" }) },
      ],
    },
  ];

  return <ScrollGlobe sections={sections} />;
}
