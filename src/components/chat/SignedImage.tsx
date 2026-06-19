import { useEffect, useState } from "react";
import { signMedia } from "@/lib/chat";

export function SignedImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let m = true;
    signMedia(path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [path]);
  if (!url) return <div className={`${className} bg-velvet/30 animate-pulse`} />;
  return <img src={url} className={className} loading="lazy" alt="" />;
}
