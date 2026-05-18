/**
 * MediaCarousel
 *
 * A peek-style swipe carousel for post images and videos.
 * Features:
 *  - Touch/mouse swipe with peek of next/prev item
 *  - Dot indicators (hidden when only 1 item)
 *  - Pinch-to-zoom on images
 *  - Tap-to-play / tap-to-pause for videos
 *  - Multi-image badge on the first frame (optional)
 *
 * Usage:
 *   <MediaCarousel urls={post.imageUrls} aspectRatio="3/4" />
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, Volume2, VolumeX } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVideo(url: string) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaCarouselProps {
  /** Array of image or video URLs */
  urls: string[];
  /** CSS aspect-ratio value, e.g. "3/4" or "1/1". Defaults to "3/4". */
  aspectRatio?: string;
  /** Extra class applied to the outer wrapper */
  className?: string;
  /** Show the multi-image badge (stack icon) on the first frame when >1 items */
  showBadge?: boolean;
  /** Called when the user taps the media (outside swipe gesture) */
  onClick?: () => void;
}

// ─── Pinch-to-zoom hook ───────────────────────────────────────────────────────

function usePinchZoom(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
  const origin = useRef({ x: 0.5, y: 0.5 });
  const lastDist = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    function dist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || !el) return;
      e.preventDefault();
      const d = dist(e.touches);
      if (lastDist.current !== null) {
        const delta = d / lastDist.current;
        scale.current = Math.min(4, Math.max(1, scale.current * delta));
        const rect = el.getBoundingClientRect();
        const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width;
        const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height;
        origin.current = { x: cx, y: cy };
        el.style.transformOrigin = `${cx * 100}% ${cy * 100}%`;
        el.style.transform = `scale(${scale.current})`;
      }
      lastDist.current = d;
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        lastDist.current = null;
        if (scale.current < 1.05 && el) {
          scale.current = 1;
          el.style.transform = "scale(1)";
        }
      }
    }

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled]);

  return ref;
}

// ─── VideoFrame ───────────────────────────────────────────────────────────────

function VideoFrame({ url, active }: { url: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Pause when slide becomes inactive
  useEffect(() => {
    if (!active && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [active]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        playsInline
        loop
        muted={muted}
        onEnded={() => setPlaying(false)}
      />
      {/* Play / pause overlay */}
      {!playing && (
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </div>
        </button>
      )}
      {playing && (
        <button
          onClick={toggle}
          className="absolute inset-0"
          aria-label="Pause"
        />
      )}
      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
      >
        {muted
          ? <VolumeX className="w-4 h-4 text-white" />
          : <Volume2 className="w-4 h-4 text-white" />
        }
      </button>
    </div>
  );
}

// ─── MediaCarousel ────────────────────────────────────────────────────────────

export function MediaCarousel({
  urls,
  aspectRatio = "3/4",
  className,
  showBadge = true,
  onClick,
}: MediaCarouselProps) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragDelta = useRef(0);

  // Pinch-to-zoom only on image frames
  const zoomRef = usePinchZoom(!isVideo(urls[current] ?? ""));

  const count = urls.length;

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(count - 1, idx)));
  }, [count]);

  // ── Pointer / touch swipe ──────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    isDragging.current = false;
    dragDelta.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - (startY.current ?? 0));
    // Only treat as horizontal swipe if dx > dy
    if (Math.abs(dx) > 6 && Math.abs(dx) > dy) {
      isDragging.current = true;
      dragDelta.current = dx;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (isDragging.current) {
      e.stopPropagation();
      if (dragDelta.current < -40) goTo(current + 1);
      else if (dragDelta.current > 40) goTo(current - 1);
    } else if (onClick) {
      onClick();
    }
    startX.current = null;
    startY.current = null;
    isDragging.current = false;
    dragDelta.current = 0;
  }

  if (!urls || urls.length === 0) {
    return (
      <div
        className={cn("w-full bg-muted flex items-center justify-center", className)}
        style={{ aspectRatio }}
      >
        <span className="text-muted-foreground text-xs">No media</span>
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden select-none", className)}
      style={{ aspectRatio }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Slide track ─────────────────────────────────────────────────── */}
      {/* Peek: slides are 92% wide with a 4% gap on each side so adjacent frames peek in */}
      <div
        ref={trackRef}
        className="flex h-full transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: count > 1
            ? `translateX(calc(-${current * 92}% + ${current === 0 ? 4 : current === count - 1 ? -4 : 0}% + ${current * -8}px))`
            : "translateX(0)",
        }}
      >
        {urls.map((url, i) => (
          <div
            key={i}
            className="relative shrink-0 h-full"
            style={{
              // Each slide takes 92% of container width; 4% peek on each side
              width: count > 1 ? "calc(92% - 8px)" : "100%",
              marginRight: count > 1 ? "8px" : "0",
            }}
          >
            {isVideo(url) ? (
              <VideoFrame url={url} active={i === current} />
            ) : (
              <div ref={i === current ? zoomRef : undefined} className="w-full h-full overflow-hidden">
                <img
                  src={url}
                  alt={`media ${i + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Peek gradient hints ──────────────────────────────────────────── */}
      {count > 1 && current > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
      )}
      {count > 1 && current < count - 1 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
      )}

      {/* ── Dot indicators ──────────────────────────────────────────────── */}
      {count > 1 && (
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {urls.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-200",
                i === current
                  ? "w-4 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/50"
              )}
            />
          ))}
        </div>
      )}

      {/* ── Multi-media badge (top-right) ────────────────────────────────── */}
      {showBadge && count > 1 && current === 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 pointer-events-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          <span className="text-white text-[10px] font-medium">{count}</span>
        </div>
      )}
    </div>
  );
}

export default MediaCarousel;
