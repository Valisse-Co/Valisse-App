/**
 * MediaCarousel
 *
 * A peek-style swipe carousel for post images and videos.
 * Features:
 *  - Touch/pointer swipe with pointer capture for reliable gesture tracking
 *  - Peek of adjacent slides (8% visible on each side)
 *  - Dot indicators (hidden when only 1 item)
 *  - Pinch-to-zoom on images
 *  - Tap-to-play / tap-to-pause for videos
 *  - Tap anywhere (outside swipe) fires onClick
 *  - Multi-image badge on the first frame (optional)
 *
 * Usage:
 *   <MediaCarousel urls={post.imageUrls} aspectRatio="3/4" onClick={() => navigate(`/post/${id}`)} />
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
  /** Called when the user taps the media without swiping */
  onClick?: () => void;
}

// ─── Pinch-to-zoom hook ───────────────────────────────────────────────────────

function usePinchZoom(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
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
        <button onClick={toggle} className="absolute inset-0" aria-label="Pause" />
      )}
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe state — all in refs so we don't re-render mid-gesture
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const hasSwiped = useRef(false);
  const pointerId = useRef<number | null>(null);

  // Pinch-to-zoom only on image frames
  const zoomRef = usePinchZoom(!isVideo(urls[current] ?? ""));

  const count = urls.length;

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(count - 1, idx)));
  }, [count]);

  // ── Pointer events with capture for reliable swipe tracking ──────────────

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only track primary pointer (ignore multi-touch for swipe)
    if (e.button !== 0 && e.pointerType !== "touch") return;
    // Capture so we keep receiving events even if pointer leaves the element
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    hasSwiped.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null || e.pointerId !== pointerId.current) return;
    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - (startY.current ?? 0));
    if (Math.abs(dx) > 8 && Math.abs(dx) > dy) {
      hasSwiped.current = true;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    if (hasSwiped.current && startX.current !== null) {
      const dx = e.clientX - startX.current;
      if (dx < -40) goTo(current + 1);
      else if (dx > 40) goTo(current - 1);
    } else if (!hasSwiped.current && onClick) {
      // Pure tap — no swipe detected
      onClick();
    }
    startX.current = null;
    startY.current = null;
    hasSwiped.current = false;
    pointerId.current = null;
  }

  function onPointerCancel() {
    startX.current = null;
    startY.current = null;
    hasSwiped.current = false;
    pointerId.current = null;
  }

  if (!urls || urls.length === 0) {
    return (
      <div
        className={cn("w-full bg-muted flex items-center justify-center", className)}
        style={{ aspectRatio }}
        onClick={onClick}
      >
        <span className="text-muted-foreground text-xs">No media</span>
      </div>
    );
  }

  // Peek layout: each slide is 88% wide, centred with 6% peeking on each side.
  // translateX shifts by (slideWidth + gap) per step.
  const SLIDE_PCT = count > 1 ? 88 : 100;
  const GAP_PX = count > 1 ? 8 : 0;
  // Offset to centre the active slide: (100 - SLIDE_PCT) / 2 = 6%
  const CENTRE_OFFSET = count > 1 ? (100 - SLIDE_PCT) / 2 : 0;
  const translateX = count > 1
    ? `calc(-${current * SLIDE_PCT}% - ${current * GAP_PX}px + ${CENTRE_OFFSET}%)`
    : "0%";

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden select-none touch-pan-y", className)}
      style={{ aspectRatio }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* ── Slide track ─────────────────────────────────────────────────── */}
      <div
        className="flex h-full transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translateX(${translateX})` }}
      >
        {urls.map((url, i) => (
          <div
            key={i}
            className="relative shrink-0 h-full rounded-xl overflow-hidden"
            style={{
              width: `${SLIDE_PCT}%`,
              marginRight: i < count - 1 ? `${GAP_PX}px` : 0,
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

      {/* ── Multi-media badge ────────────────────────────────────────────── */}
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
