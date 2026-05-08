import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bookmark, Heart, SlidersHorizontal, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const STYLES = ["All", "Minimalist", "Bold", "Floral", "Geometric", "Glam", "Natural", "Abstract", "French"];
const SHAPES = ["All", "Square", "Round", "Oval", "Almond", "Stiletto", "Coffin"];
const COLORS = ["All", "Nude", "White", "Black", "Pink", "Red", "Blue", "Green", "Purple", "Gold"];

export default function Discover() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showFilters, setShowFilters] = useState(false);
  const [activeStyle, setActiveStyle] = useState("All");
  const [activeShape, setActiveShape] = useState("All");
  const [activeColor, setActiveColor] = useState("All");

  const filters = useMemo(() => ({
    style: activeStyle !== "All" ? activeStyle : undefined,
    shape: activeShape !== "All" ? activeShape : undefined,
    color: activeColor !== "All" ? activeColor : undefined,
  }), [activeStyle, activeShape, activeColor]);

  const { data: feed, isLoading, refetch } = trpc.posts.feed.useQuery({ limit: 40, offset: 0, ...filters });
  const postIds = useMemo(() => feed?.map(f => f.post.id) ?? [], [feed]);
  const { data: userLikes } = trpc.posts.userLikes.useQuery(
    { postIds },
    { enabled: isAuthenticated && postIds.length > 0 }
  );
  const likedSet = useMemo(() => new Set((userLikes ?? []).map(l => l.postId)), [userLikes]);

  const utils = trpc.useUtils();
  const toggleLike = trpc.posts.toggleLike.useMutation({
    onMutate: async ({ postId }) => {
      // optimistic update
    },
    onSuccess: () => {
      utils.posts.feed.invalidate();
      utils.posts.userLikes.invalidate();
    },
  });
  const toggleSave = trpc.posts.toggleSave.useMutation({
    onSuccess: (data) => {
      toast.success(data.saved ? "Saved to collection" : "Removed from saved");
      utils.collections.savedPosts.invalidate();
    },
  });

  const handleLike = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { toast.error("Sign in to like posts"); return; }
    toggleLike.mutate({ postId });
  };

  const handleSave = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { toast.error("Sign in to save posts"); return; }
    toggleSave.mutate({ postId });
  };

  // Split feed into two columns
  const leftCol = feed?.filter((_, i) => i % 2 === 0) ?? [];
  const rightCol = feed?.filter((_, i) => i % 2 === 1) ?? [];

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
              showFilters ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            {(activeStyle !== "All" || activeShape !== "All" || activeColor !== "All") && (
              <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Quick style chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {STYLES.map(s => (
            <button
              key={s}
              onClick={() => setActiveStyle(s)}
              className={cn(
                "flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all duration-150",
                activeStyle === s
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border text-muted-foreground"
              )}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-card border-b border-border px-4 py-4 space-y-4"
        >
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
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setActiveColor(c)}
                  className={cn("px-3 py-1 rounded-full text-xs border transition-all",
                    activeColor === c ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground"
                  )}>{c}</button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setActiveStyle("All"); setActiveShape("All"); setActiveColor("All"); }}
            className="text-xs text-muted-foreground flex items-center gap-1"
          >
            <X size={12} /> Clear all filters
          </button>
        </motion.div>
      )}

      {/* Feed Grid */}
      <div className="px-3 pt-3 pb-2">
        {isLoading ? (
          <div className="masonry-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={cn("masonry-item rounded-2xl bg-muted animate-pulse", i % 3 === 0 ? "h-64" : "h-48")} />
            ))}
          </div>
        ) : feed?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">No posts found.<br />Try different filters.</p>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Left column */}
            <div className="flex-1 flex flex-col gap-3">
              {leftCol.map(({ post, tech, analytics }) => (
                <PostCard
                  key={post.id}
                  post={post}
                  tech={tech}
                  analytics={analytics}
                  liked={likedSet.has(post.id)}
                  onLike={handleLike}
                  onSave={handleSave}
                  onClick={() => navigate(`/post/${post.id}`)}
                />
              ))}
            </div>
            {/* Right column */}
            <div className="flex-1 flex flex-col gap-3 mt-6">
              {rightCol.map(({ post, tech, analytics }) => (
                <PostCard
                  key={post.id}
                  post={post}
                  tech={tech}
                  analytics={analytics}
                  liked={likedSet.has(post.id)}
                  onLike={handleLike}
                  onSave={handleSave}
                  onClick={() => navigate(`/post/${post.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, tech, analytics, liked, onLike, onSave, onClick }: any) {
  const imageUrl = post.imageUrls?.[0];
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden cursor-pointer bg-muted shadow-sm"
    >
      {imageUrl ? (
        <img src={imageUrl} alt={post.caption ?? "nail art"} className="w-full object-cover" style={{ aspectRatio: "3/4" }} />
      ) : (
        <div className="w-full bg-gradient-to-br from-[#F0E8E6] to-[#E6F5F1]" style={{ aspectRatio: "3/4" }}>
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">💅</span>
          </div>
        </div>
      )}

      {/* Promoted badge */}
      {post.isPromoted && (
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full">
          Promoted
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 img-overlay" />

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-xs font-medium truncate">{tech?.businessName || tech?.name || "Nail Tech"}</p>
        {post.location && <p className="text-white/70 text-[10px] truncate">{post.location}</p>}
      </div>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <button
          onClick={(e) => onLike(post.id, e)}
          className={cn(
            "w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-all",
            liked ? "bg-red-500/80 text-white" : "bg-black/30 text-white"
          )}
        >
          <Heart size={14} fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          onClick={(e) => onSave(post.id, e)}
          className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
        >
          <Bookmark size={14} />
        </button>
      </div>
    </motion.div>
  );
}
