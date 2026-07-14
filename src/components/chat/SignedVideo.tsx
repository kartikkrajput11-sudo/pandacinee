import { useEffect, useState } from "react";
import { signMedia } from "@/lib/chat";

export function SignedVideo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);
  if (!url) return <div className="rounded-xl bg-velvet/30 animate-pulse w-[240px] h-[180px]" />;
  return (
    <video
      src={url}
      controls
      preload="metadata"
      playsInline
      className="rounded-xl max-w-[260px] max-h-[360px] bg-black"
    />
  );
}
