import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bookmark, SlidersHorizontal, X, Search, MapPin, Clock, LocateFixed, Bell, Flag, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { STYLE_TAG_GROUPS, NAIL_COLORS, MULTI_COLOR_TAG } from "@shared/const";
import { MediaCarousel } from "@/components/MediaCarousel";
import { ReportSheet } from "@/components/ReportSheet";

const SHAPES = ["All", "Square", "Round", "Oval", "Almond", "Stiletto", "Coffin"];

const DISTANCE_OPTIONS = [
  { label: "5 mi", value: 5 },
  { label: "10 mi", value: 10 },
  { label: "25 mi", value: 25 },
  { label: "50+ mi", value: 9999 },
];

// Flat "All" + all group tags for the quick horizontal scroll row
const QUICK_STYLE_CHIPS = ["All", ...STYLE_TAG_GROUPS[0].tags, ...STYLE_TAG_GROUPS[1].tags];

export default function Discover() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showFilters, setShowFilters] = useState(false);

  // Multi-select style tags
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const [activeShape, setActiveShape] = useState("All");
  // Multi-select colors
  const [activeColors, setActiveColors] = useState<string[]>([]);
  const [multiColorOnly, setMultiColorOnly] = useState(false);
  // Location — default 10mi always active
  const [distanceMiles, setDistanceMiles] = useState<number>(10);
  const [soonestAvailable, setSoonestAvailable] = useState(false);
  const [subscriptionsOnly, setSubscriptionsOnly] = useState(false);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);

  const toggleStyleTag = (tag: string) => {
    if (tag === "All") { setActiveStyles([]); return; }
    setActiveStyles(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleColor = (color: string) => {
    setActiveColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Location detected!");
      },
      () => { setLocating(false); toast.error("Could not detect location. Please allow access."); },
      { timeout: 8000 }
    );
  };

  const handleDistanceSelect = (miles: number) => {
    setDistanceMiles(miles);
    if (!userLat || !userLng) requestLocation();
  };

  const filters = useMemo(() => ({
    styles: activeStyles.length > 0 ? activeStyles : undefined,
    shape: activeShape !== "All" ? activeShape : undefined,
    colors: activeColors.length > 0 ? activeColors : undefined,
    multiColor: multiColorOnly || undefined,
    distanceMiles: userLat && userLng ? distanceMiles : distanceMiles, // always pass distance
    userLat: userLat,
    userLng: userLng,
    soonestAvailable: soonestAvailable || undefined,
    subscriptionsOnly: subscriptionsOnly || undefined,
  }), [activeStyles, activeShape, activeColors, multiColorOnly, distanceMiles, userLat, userLng, soonestAvailable, subscriptionsOnly]);

  const { data: rawFeed, isLoading } = trpc.posts.feed.useQuery({ limit: 40, offset: 0, ...filters });

  // Separate exact matches from partial matches using the _divider marker
  const { exactFeed, partialFeed } = useMemo(() => {
    if (!rawFeed) return { exactFeed: [], partialFeed: [] };
    const dividerIdx = rawFeed.findIndex((r: any) => r._divider);
    if (dividerIdx === -1) return { exactFeed: rawFeed as any[], partialFeed: [] };
    return {
      exactFeed: rawFeed.slice(0, dividerIdx) as any[],
      partialFeed: rawFeed.slice(dividerIdx + 1) as any[],
    };
  }, [rawFeed]);

  const { data: userSaves } = trpc.collections.savedPosts.useQuery(undefined, { enabled: isAuthenticated });
  const savedSet = useMemo(
    () => new Set((userSaves ?? []).map((s: any) => s.savedPost?.postId ?? s.post?.id)),
    [userSaves]
  );

  const utils = trpc.useUtils();
  const toggleSave = trpc.posts.toggleSave.useMutation({
    onSuccess: (data) => {
      toast.success(data.saved ? "Saved to collection" : "Removed from saved");
      utils.collections.savedPosts.invalidate();
      utils.posts.feed.invalidate();
    },
  });

  const handleSave = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { toast.error("Sign in to save posts"); return; }
    toggleSave.mutate({ postId });
  };

  const clearAll = () => {
    setActiveStyles([]);
    setActiveShape("All");
    setActiveColors([]);
    setMultiColorOnly(false);
    setDistanceMiles(10);
    setSoonestAvailable(false);
    setSubscriptionsOnly(false);
  };

  const hasActiveFilters =
    activeStyles.length > 0 ||
    activeShape !== "All" ||
    activeColors.length > 0 ||
    multiColorOnly ||
    distanceMiles !== 10 ||
    soonestAvailable ||
    subscriptionsOnly;

  // Build two-column masonry for each section
  const buildCols = (items: any[]) => ({
    left: items.filter((_, i) => i % 2 === 0),
    right: items.filter((_, i) => i % 2 === 1),
  });

  const exactCols = buildCols(exactFeed);
  const partialCols = buildCols(partialFeed);
  const hasPartial = partialFeed.length > 0;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-display font-light tracking-wide">Discover</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              showFilters || hasActiveFilters
                ? "bg-primary text-white border-primary"
                : "bg-card border-border text-foreground"
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />}
          </button>
        </div>

        {/* Quick style chips — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {isAuthenticated && (
            <button
              onClick={() => setSubscriptionsOnly(v => !v)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-all duration-150",
                subscriptionsOnly
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border text-muted-foreground"
              )}
            >
              <Bell size={11} />
              Following
            </button>
          )}
          {QUICK_STYLE_CHIPS.map(s => {
            const isAll = s === "All";
            const active = isAll ? activeStyles.length === 0 : activeStyles.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleStyleTag(s)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all duration-150",
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-card border-border text-muted-foreground"
                )}
              >{s}</button>
            );
          })}
        </div>

        {/* Active filter pills */}
        {(activeStyles.length > 1 || activeColors.length > 0 || multiColorOnly || distanceMiles !== 10 || soonestAvailable) && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {activeStyles.slice(1).map(tag => (
              <span key={tag} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {tag}
                <button onClick={() => toggleStyleTag(tag)}><X size={10} /></button>
              </span>
            ))}
            {activeColors.map(c => (
              <span key={c} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {c}
                <button onClick={() => toggleColor(c)}><X size={10} /></button>
              </span>
            ))}
            {multiColorOnly && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Layers size={10} />
                Multi-Color
                <button onClick={() => setMultiColorOnly(false)}><X size={10} /></button>
              </span>
            )}
            {distanceMiles !== 10 && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <MapPin size={10} />
                {distanceMiles >= 9999 ? "50+ mi" : `${distanceMiles} mi`}
                <button onClick={() => setDistanceMiles(10)}><X size={10} /></button>
              </span>
            )}
            {soonestAvailable && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Clock size={10} />
                Soonest Available
                <button onClick={() => setSoonestAvailable(false)}><X size={10} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border-b border-border px-4 py-4 space-y-5 overflow-hidden"
          >
            {/* Style — grouped multi-select */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</p>
                {activeStyles.length > 0 && (
                  <button onClick={() => setActiveStyles([])} className="text-xs text-primary">Clear</button>
                )}
              </div>
              <div className="space-y-3">
                {STYLE_TAG_GROUPS.map(({ group, tags }) => (
                  <div key={group}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(tag => {
                        const active = activeStyles.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleStyleTag(tag)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs border transition-all",
                              active
                                ? "bg-primary text-white border-primary"
                                : "bg-background border-border text-foreground hover:border-primary hover:text-primary"
                            )}
                          >{tag}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Color — multi-select + Multi-Color toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color</p>
                {(activeColors.length > 0 || multiColorOnly) && (
                  <button onClick={() => { setActiveColors([]); setMultiColorOnly(false); }} className="text-xs text-primary">Clear</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {/* Multi-Color special chip */}
                <button
                  onClick={() => setMultiColorOnly(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-all font-medium",
                    multiColorOnly
                      ? "bg-primary text-white border-primary"
                      : "bg-background border-border text-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  <Layers size={11} />
                  {MULTI_COLOR_TAG}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {NAIL_COLORS.map(c => {
                  const active = activeColors.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleColor(c)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border transition-all",
                        active
                          ? "bg-primary text-white border-primary"
                          : "bg-background border-border text-foreground hover:border-primary hover:text-primary"
                      )}
                    >{c}</button>
                  );
                })}
              </div>
            </div>

            {/* Distance — default 10mi */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance</p>
                {locating && <span className="text-xs text-primary flex items-center gap-1"><LocateFixed size={10} className="animate-pulse" /> Detecting…</span>}
                {userLat && !locating && <span className="text-xs text-primary flex items-center gap-1"><LocateFixed size={10} /> Location set</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {DISTANCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleDistanceSelect(opt.value)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-all",
                      distanceMiles === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-background border-border text-foreground"
                    )}
                  >
                    <MapPin size={10} />{opt.label}
                  </button>
                ))}
              </div>
              {!userLat && !locating && (
                <button onClick={requestLocation} className="mt-2 text-xs text-primary flex items-center gap-1">
                  <LocateFixed size={11} /> Allow location to refine distance results
                </button>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Default: 10 mi. Posts outside your range appear in Similar Matches.</p>
            </div>

            {/* Soonest Available */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Availability</p>
              <button
                onClick={() => setSoonestAvailable(!soonestAvailable)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all",
                  soonestAvailable ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground"
                )}
              >
                <Clock size={11} />Soonest Available
              </button>
              <p className="text-[10px] text-muted-foreground mt-1.5">Prioritizes nail techs with open appointments this week</p>
            </div>

            {/* Shape */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Shape</p>
              <div className="flex flex-wrap gap-2">
                {SHAPES.map(s => (
                  <button key={s} onClick={() => setActiveShape(s)}
                    className={cn("px-3 py-1 rounded-full text-xs border transition-all",
                      activeShape === s ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground"
                    )}>{s}</button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button onClick={clearAll} className="text-xs text-muted-foreground flex items-center gap-1">
                <X size={12} /> Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed Grid */}
      <div className="px-3 pt-3 pb-24">
        {isLoading ? (
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className={cn("rounded-2xl bg-muted animate-pulse", i % 2 === 0 ? "h-64" : "h-48")} />)}
            </div>
            <div className="flex-1 flex flex-col gap-3 mt-6">
              {[1, 2, 3].map(i => <div key={i} className={cn("rounded-2xl bg-muted animate-pulse", i % 2 === 0 ? "h-48" : "h-64")} />)}
            </div>
          </div>
        ) : exactFeed.length === 0 && partialFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              No posts found.<br />
              {!userLat
                ? "Allow location access to see nearby results."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Exact matches */}
            {exactFeed.length > 0 && (
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-3">
                  {exactCols.left.map(({ post, tech, analytics }: any) => (
                    <PostCard key={post.id} post={post} tech={tech} analytics={analytics}
                      saved={savedSet.has(post.id)} onSave={handleSave}
                      onClick={() => navigate(`/post/${post.id}?from=/discover`)} />
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-3 mt-6">
                  {exactCols.right.map(({ post, tech, analytics }: any) => (
                    <PostCard key={post.id} post={post} tech={tech} analytics={analytics}
                      saved={savedSet.has(post.id)} onSave={handleSave}
                      onClick={() => navigate(`/post/${post.id}?from=/discover`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Similar Matches divider */}
            {hasPartial && (
              <div className="relative flex items-center my-5">
                <div className="flex-1 border-t border-border/50" />
                <span className="mx-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">
                  Similar Matches
                </span>
                <div className="flex-1 border-t border-border/50" />
              </div>
            )}

            {/* Partial matches */}
            {hasPartial && (
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-3">
                  {partialCols.left.map(({ post, tech, analytics }: any) => (
                    <PostCard key={post.id} post={post} tech={tech} analytics={analytics}
                      saved={savedSet.has(post.id)} onSave={handleSave}
                      onClick={() => navigate(`/post/${post.id}?from=/discover`)} />
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-3 mt-6">
                  {partialCols.right.map(({ post, tech, analytics }: any) => (
                    <PostCard key={post.id} post={post} tech={tech} analytics={analytics}
                      saved={savedSet.has(post.id)} onSave={handleSave}
                      onClick={() => navigate(`/post/${post.id}?from=/discover`)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, tech, analytics, saved, onSave, onClick }: any) {
  const urls: string[] = post.imageUrls ?? [];
  const [reportOpen, setReportOpen] = useState(false);

  // Parse multi-color tags
  const postColors: string[] = (() => {
    if (post.postColors) return post.postColors;
    if (!post.colors) return post.color ? [post.color] : [];
    try {
      const parsed = typeof post.colors === "string" ? JSON.parse(post.colors) : post.colors;
      return Array.isArray(parsed) ? parsed : (post.color ? [post.color] : []);
    } catch { return post.color ? [post.color] : []; }
  })();
  const isMultiColor = post.isMultiColor ?? postColors.length >= 2;

  const [colorChipExpanded, setColorChipExpanded] = useState(false);

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="relative rounded-2xl overflow-hidden cursor-pointer bg-muted shadow-sm"
    >
      {urls.length > 0 ? (
        <MediaCarousel
          urls={urls}
          aspectRatio="3/4"
          showBadge
          onClick={onClick}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-[#E6F5F1] to-[#D0EDE6] cursor-pointer"
          style={{ aspectRatio: "3/4" }}
          onClick={onClick}
        >
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">💅</span>
          </div>
        </div>
      )}

      {post.isPromoted && (
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full pointer-events-none">
          Promoted
        </div>
      )}

      <div className="absolute inset-0 img-overlay pointer-events-none" />

      <div
        className="absolute bottom-0 left-0 right-0 p-2.5 pointer-events-none"
        onClick={onClick}
      >
        <p className="text-white text-xs font-medium truncate">{tech?.businessName || tech?.name || "Nail Tech"}</p>
        {post.location && <p className="text-white/70 text-[10px] truncate">{post.location}</p>}
        {analytics?.saves > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Bookmark size={10} className="text-white/70 fill-white/70" />
            <span className="text-white/70 text-[10px]">{analytics.saves}</span>
          </div>
        )}
      </div>

      {/* Multi-color chip */}
      {isMultiColor && postColors.length >= 2 && (
        <button
          onClick={(e) => { e.stopPropagation(); setColorChipExpanded(v => !v); }}
          className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full z-10"
        >
          <Layers size={9} />
          {colorChipExpanded
            ? postColors.join(", ")
            : `Multi-Color`}
        </button>
      )}

      {/* Bookmark button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSave(post.id, e); }}
        className={cn(
          "absolute top-2 right-2 w-9 h-9 rounded-full backdrop-blur-sm flex items-center justify-center transition-all shadow-sm z-10",
          saved ? "bg-primary text-white" : "bg-black/30 text-white"
        )}
      >
        <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
      </button>

      {/* Report button */}
      <button
        onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
        className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm text-white/70 flex items-center justify-center z-10"
        title="Report post"
      >
        <Flag size={12} />
      </button>

      <ReportSheet postId={post.id} open={reportOpen} onOpenChange={setReportOpen} />
    </motion.div>
  );
}
