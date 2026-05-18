import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Bookmark, Share2, Star, MapPin, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaCarousel } from "@/components/MediaCarousel";

interface Props { postId: number }

export default function PostDetail({ postId }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const isPreview = new URLSearchParams(search).get("preview") === "1";

  const { data, isLoading } = trpc.posts.getById.useQuery({ postId });
  const utils = trpc.useUtils();

  // "More from this artist" — load other posts by the same tech
  const { data: morePosts } = trpc.posts.techPosts.useQuery(
    { techId: data?.post?.techId ?? 0 },
    { enabled: !!data?.post?.techId }
  );

  const toggleSave = trpc.posts.toggleSave.useMutation({
    onSuccess: (res) => {
      toast.success(res.saved ? "Saved!" : "Removed from saved");
      utils.posts.getById.invalidate({ postId });
      utils.posts.feed.invalidate();
    },
  });
  const getOrCreateConv = trpc.messaging.getOrCreateConversation.useMutation({
    onSuccess: (conv) => navigate(`/chat/${conv.id}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-muted-foreground">Post not found</div>;

  const { post, tech, ratingStats } = data;
  const mediaUrls: string[] = post.imageUrls ?? [];
  const techName = tech?.businessName || tech?.name || "this artist";

  // "More from this artist" — exclude current post, cap at 6
  const moreFromArtist = (morePosts ?? [])
    .filter(({ post: p }: any) => p.id !== postId && p.status === "published")
    .slice(0, 6);

  const handleBook = () => {
    if (isPreview) {
      toast.info("This is a preview — clients will be taken to your booking page.");
      return;
    }
    if (!isAuthenticated) { toast.error("Sign in to book"); return; }
    navigate(`/book/${tech?.id}?postId=${postId}`);
  };

  const handleMessage = () => {
    if (isPreview) {
      toast.info("This is a preview — clients will open a chat with you.");
      return;
    }
    if (!isAuthenticated) { toast.error("Sign in to message"); return; }
    if (!tech) return;
    getOrCreateConv.mutate({ techId: tech.id });
  };

  return (
    <div className="min-h-screen bg-background page-enter">

      {/* ── Client View banner (nail tech preview only) ── */}
      {isPreview && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-primary/90 backdrop-blur-sm text-white text-xs font-medium py-2 px-4">
          <Eye size={13} />
          <span>Client View — this is exactly what clients see</span>
        </div>
      )}

      {/* Hero media carousel */}
      <div className="relative">
        {mediaUrls.length > 0 ? (
          <MediaCarousel
            urls={mediaUrls}
            aspectRatio="4/5"
            showBadge={false}
            className="w-full"
          />
        ) : (
          <div className="w-full h-96 bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
            <span className="text-6xl">💅</span>
          </div>
        )}

        {/* Gradient overlay — only on top for back/action buttons */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Action buttons — save is the primary engagement action */}
        {!isPreview && (
          <div className="absolute top-12 right-4 flex flex-col gap-2">
            <button
              onClick={() => isAuthenticated ? toggleSave.mutate({ postId }) : toast.error("Sign in to save")}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <Bookmark size={18} />
            </button>
            <button
              onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied!"); }}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <Share2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-5 pb-32">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.style && <Tag label={post.style} />}
          {post.shape && <Tag label={post.shape} />}
          {post.color && <Tag label={post.color} />}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-foreground text-sm leading-relaxed mb-5">{post.caption}</p>
        )}

        {/* Location */}
        {post.location && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-5">
            <MapPin size={14} />
            <span>{post.location}</span>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border mb-5" />

        {/* Nail Tech preview card */}
        {tech && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6 cursor-pointer"
            onClick={() => !isPreview && navigate(`/tech/${tech.id}`)}
          >
            <Avatar className="w-14 h-14 border-2 border-border">
              <AvatarImage src={tech.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent text-primary font-semibold">
                {(tech.name ?? "N").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{techName}</p>
              {tech.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={11} />{tech.location}
                </p>
              )}
              {ratingStats && ratingStats.count > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={11} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium">{ratingStats.average.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({ratingStats.count})</span>
                </div>
              )}
            </div>
            {!isPreview && <ChevronRight size={18} className="text-muted-foreground" />}
          </motion.div>
        )}

        {/* ── More from this artist ── */}
        {moreFromArtist.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">More from {techName}</h3>
              {!isPreview && tech && (
                <button
                  onClick={() => navigate(`/tech/${tech.id}`)}
                  className="text-xs text-primary font-medium"
                >
                  View all
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {moreFromArtist.map(({ post: p }: any) => (
                <motion.div
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(`/post/${p.id}${isPreview ? "?preview=1" : ""}`)}
                  className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer"
                >
                  {p.imageUrls?.[0] ? (
                    <img src={p.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#E6F5F1] to-[#D0EDE6] flex items-center justify-center">
                      <span className="text-xl">💅</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed CTA buttons */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
        <div className="flex gap-3 bg-background/95 backdrop-blur-sm pt-3 pb-2 rounded-2xl shadow-lg border border-border px-3">
          <button
            onClick={handleMessage}
            disabled={getOrCreateConv.isPending}
            className="flex-1 btn-valisse-outline py-3.5 text-sm font-medium"
          >
            Message
          </button>
          <button
            onClick={handleBook}
            className="flex-1 btn-valisse py-3.5 text-sm font-semibold"
          >
            {isPreview ? `Book With ${techName}` : "Book This Look"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
      {label}
    </span>
  );
}
