import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions · PANDACINE" },
      { name: "description", content: "The terms and conditions for using PANDACINE." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-velvet text-candle px-5 py-14">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-petal">Legal</p>
          <h1 className="font-serif text-3xl italic">Terms &amp; Conditions</h1>
          <p className="text-xs text-candle-muted">
            This page is maintained by the PANDACINE team. Last updated: {new Date().getFullYear()}.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-candle-muted">
          <p>
            Welcome to PANDACINE. By creating an account or using the app, you agree to these Terms &amp; Conditions.
            If you do not agree, please do not use the service.
          </p>

          <h2 className="text-candle font-medium mt-4">1. Your Account</h2>
          <p>
            You are responsible for the accuracy of the information you provide and for keeping your credentials safe.
            PANDACINE is intended for personal, non-commercial use between you and your invited partner or friends.
          </p>

          <h2 className="text-candle font-medium mt-4">2. Acceptable Use</h2>
          <p>
            Do not use PANDACINE to harass, threaten, impersonate, or share unlawful content. We may suspend accounts
            that violate these rules or that we reasonably believe are abusive.
          </p>

          <h2 className="text-candle font-medium mt-4">3. Your Content</h2>
          <p>
            You retain ownership of the messages, media, and memories you upload. You grant us a limited license to
            store and display that content solely so we can deliver the app to you and the people you share with.
          </p>

          <h2 className="text-candle font-medium mt-4">4. Availability</h2>
          <p>
            The service is provided as-is. Features may change, pause, or be removed. We aim for reliability but do not
            guarantee uninterrupted access.
          </p>

          <h2 className="text-candle font-medium mt-4">5. Termination</h2>
          <p>
            You may delete your account at any time from Settings. We may suspend or terminate accounts that breach
            these terms or endanger other users.
          </p>

          <h2 className="text-candle font-medium mt-4">6. Contact</h2>
          <p>
            Questions about these terms? Reach out from within the app's help section.
          </p>
        </section>

        <div className="pt-6">
          <Link to="/auth" className="text-xs text-petal hover:underline">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
