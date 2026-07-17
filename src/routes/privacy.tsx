import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · PANDACINE" },
      { name: "description", content: "How PANDACINE handles your personal information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-velvet text-candle px-5 py-14">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-petal">Legal</p>
          <h1 className="font-serif text-3xl italic">Privacy Policy</h1>
          <p className="text-xs text-candle-muted">
            This page is maintained by the PANDACINE team. Last updated: {new Date().getFullYear()}.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-candle-muted">
          <h2 className="text-candle font-medium">What we collect</h2>
          <p>
            Account details you give us (name, email), the content you create in the app (messages, media, memories),
            and basic technical logs needed to operate the service.
          </p>

          <h2 className="text-candle font-medium mt-4">How we use it</h2>
          <p>
            We use your information to authenticate you, sync your content between you and the people you invite, and
            keep the service running securely. We do not sell your personal data.
          </p>

          <h2 className="text-candle font-medium mt-4">Who can see your content</h2>
          <p>
            Private messages and memories are visible to you and the partner or group you share them with. Admin staff
            may access data only when strictly necessary for support, security, or legal reasons.
          </p>

          <h2 className="text-candle font-medium mt-4">Storage &amp; security</h2>
          <p>
            Data is stored with our hosting and backend providers using industry-standard access controls and
            encryption in transit. No online service can promise absolute security, so please use a strong password.
          </p>

          <h2 className="text-candle font-medium mt-4">Your controls</h2>
          <p>
            You can edit your profile, hide your activity, clear chats, delete media, and delete your account from
            Settings. Deleting your account removes your personal profile and content associated with it.
          </p>

          <h2 className="text-candle font-medium mt-4">Contact</h2>
          <p>
            For privacy questions or data requests, contact us through the app's help section.
          </p>
        </section>

        <div className="pt-6">
          <Link to="/auth" className="text-xs text-petal hover:underline">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
