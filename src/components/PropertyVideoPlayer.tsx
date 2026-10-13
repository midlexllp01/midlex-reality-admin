"use client";

import { useMemo } from "react";
import { AlertCircle, Play } from "lucide-react";

export function parseVideoUrl(url?: string | null): {
  type: "youtube" | "vimeo" | "direct";
  embedUrl?: string;
  directSrc?: string;
} | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube match: regular watch URL, short URL, embed, or shorts
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/i,
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
    };
  }

  // Vimeo match
  const vimeoMatch = trimmed.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i,
  );
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`,
    };
  }

  // Direct video file (mp4, webm, mov, ogg, blob, or data URL)
  return {
    type: "direct",
    directSrc: trimmed,
  };
}

export default function PropertyVideoPlayer({
  url,
  poster,
  className = "",
  autoPlay = false,
}: {
  url: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
}) {
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  if (!parsed) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center ${className}`}>
        <AlertCircle className="text-amber-400 mb-2" size={32} />
        <p className="text-sm font-semibold">Invalid or unsupported video source</p>
      </div>
    );
  }

  if (parsed.type === "youtube" || parsed.type === "vimeo") {
    return (
      <div className={`relative w-full h-full overflow-hidden bg-black ${className}`}>
        <iframe
          src={parsed.embedUrl}
          title="Property Virtual Video Tour"
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black flex items-center justify-center ${className}`}>
      <video
        src={parsed.directSrc}
        poster={poster}
        controls
        autoPlay={autoPlay}
        playsInline
        className="w-full h-full object-contain max-h-full"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
