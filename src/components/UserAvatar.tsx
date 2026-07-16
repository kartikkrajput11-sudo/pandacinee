import { useEffect, useState } from "react";
import { ensureAvatarUrl, resolveAvatarUrl } from "@/lib/avatar";

export function UserAvatar({
  src,
  name,
  className = "size-10",
  ringed = false,
}: {
  src: string | null | undefined;
  name?: string | null;
  className?: string;
  ringed?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(() => resolveAvatarUrl(src));

  useEffect(() => {
    let alive = true;
    setUrl(resolveAvatarUrl(src));
    if (src && !resolveAvatarUrl(src)) {
      ensureAvatarUrl(src).then((u) => {
        if (alive) setUrl(u);
      });
    }
    return () => {
      alive = false;
    };
  }, [src]);

  const letter = (name?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={`${className} rounded-full bg-petal-soft flex items-center justify-center overflow-hidden shrink-0 ${
        ringed ? "ring-2 ring-petal" : ""
      }`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-serif italic text-petal">{letter}</span>
      )}
    </div>
  );
}
