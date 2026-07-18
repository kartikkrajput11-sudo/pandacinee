import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ensureAvatarUrl, resolveAvatarUrl } from "@/lib/avatar";

export function UserAvatar({
  src,
  name,
  className = "size-10",
  ringed = false,
  userId,
}: {
  src: string | null | undefined;
  name?: string | null;
  className?: string;
  ringed?: boolean;
  userId?: string | null;
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
  const inner = (
    <div
      className={`${className} rounded-full bg-petal-soft flex items-center justify-center overflow-hidden shrink-0 ${
        ringed ? "ring-2 ring-petal" : ""
      } ${userId ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-serif italic text-petal">{letter}</span>
      )}
    </div>
  );

  if (userId) {
    return (
      <Link
        to="/app/user/$userId"
        params={{ userId }}
        onClick={(e) => e.stopPropagation()}
        aria-label={name ? `View ${name}'s profile` : "View profile"}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
