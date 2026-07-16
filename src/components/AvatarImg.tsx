import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { ensureAvatarUrl, resolveAvatarUrl } from "@/lib/avatar";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

/**
 * Drop-in <img> replacement for avatar_url values.
 * Resolves Supabase storage paths (e.g. "<uid>/avatar.png") to signed URLs
 * while passing through http(s)/data/blob URLs unchanged.
 * Renders nothing until a usable URL is available.
 */
export function AvatarImg({ src, alt = "", ...rest }: Props) {
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

  if (!url) return null;
  return <img src={url} alt={alt} {...rest} />;
}
