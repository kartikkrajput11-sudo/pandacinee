import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { anniversaryDayFor, annivTitle, todayKey, type AnnivDay } from "@/lib/anniversary-mode";
import { AnniversaryWorld } from "@/components/anniversary/AnniversaryWorld";


/**
 * AnniversaryDayMode — when it's the couple's day, the entire app changes skin:
 * gilded tokens, gold-dust ambience, a ribbon in the header, and a one-tap
 * doorway into the Golden Hour ceremony. Everything resets at midnight.
 */
export function AnniversaryDayMode() {
  const { data } = useProfile();
  const profile = data?.profile;
  const partner = data?.partner;
  const [day, setDay] = useState<AnnivDay>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [testing, setTesting] = useState(false);

  // Manual preview: any surface can fire `pandacine:anniv-test` to enter the
  // Nocturne takeover immediately, even when today isn't the real day.
  useEffect(() => {
    const onTest = () => {
      setTesting(true);
      setDismissed(false);
      setOpen(true);
    };
    window.addEventListener("pandacine:anniv-test", onTest);
    return () => window.removeEventListener("pandacine:anniv-test", onTest);
  }, []);


  const partnerName = partner
    ? profile?.partner_nickname || partner.display_name || "your panda"
    : "your panda";

  useEffect(() => {
    if (!profile?.partner_id) {
      setDay(null);
      return;
    }
    const compute = () =>
      setDay(anniversaryDayFor(profile.anniversary_date, profile.paired_at));
    compute();
    // Re-evaluate hourly so the gold lifts itself at midnight.
    const id = window.setInterval(compute, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [profile?.partner_id, profile?.anniversary_date, profile?.paired_at]);

  // Skin the whole document while the day lasts.
  useEffect(() => {
    const root = document.documentElement;
    if (day) root.setAttribute("data-anniv-day", "1");
    else root.removeAttribute("data-anniv-day");
    return () => root.removeAttribute("data-anniv-day");
  }, [day]);

  // Auto-open the ceremony once per day.
  useEffect(() => {
    if (!day) return;
    const key = `pandacine.golden.${todayKey()}.entered`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
    } catch {
      /* storage may be unavailable */
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [day]);

  if (!day) return null;

  return (
    <>
      {/* Ambient gilding over the whole app */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          background:
            "radial-gradient(70% 40% at 50% 0%, rgba(201,168,76,0.16), transparent 65%), radial-gradient(60% 40% at 100% 100%, rgba(240,215,140,0.10), transparent 70%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[3] overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="absolute -bottom-3 rounded-full animate-golden-dust"
            style={{
              left: `${(i * 83) % 100}%`,
              width: 3 + ((i * 3) % 4),
              height: 3 + ((i * 3) % 4),
              background: "rgba(240,215,140,0.85)",
              boxShadow: "0 0 10px rgba(201,168,76,0.8)",
              animationDelay: `${(i * 1.7) % 10}s`,
              animationDuration: `${11 + ((i * 3) % 8)}s`,
            }}
          />
        ))}
      </div>

      {/* Ribbon */}
      {!dismissed && (
        <div className="fixed top-0 inset-x-0 z-[400] px-3 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setOpen(true)}
            className="mt-2 w-full max-w-[1400px] mx-auto flex items-center gap-3 rounded-2xl border border-[#c9a84c]/45 bg-gradient-to-r from-[#1a1109]/95 via-[#241708]/95 to-[#1a1109]/95 px-4 py-2.5 backdrop-blur shadow-[0_20px_60px_-30px_rgba(201,168,76,0.8)] animate-golden-ribbon"
          >
            <Sparkles className="size-4 text-[#f0d78c] shrink-0" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[9px] uppercase tracking-[0.38em] text-[#c9a84c]">
                Golden Hour · Today only
              </span>
              <span className="block font-serif italic text-sm text-[#f7ecd2] truncate">
                {annivTitle(day)} with {partnerName}
              </span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-[#1a1109] bg-gradient-to-r from-[#c9a84c] to-[#f0d78c] rounded-full px-3 py-1 shrink-0">
              Enter
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Hide ribbon"
              onClick={(e) => {
                e.stopPropagation();
                setDismissed(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  setDismissed(true);
                }
              }}
              className="text-[#e6d3a8]/50 hover:text-[#f0d78c] text-lg leading-none px-1"
            >
              ×
            </span>
          </button>
        </div>
      )}

      {open && (
        <AnniversaryWorld day={day} partnerName={partnerName} test={testing} onClose={() => setOpen(false)} />
      )}

    </>
  );
}
