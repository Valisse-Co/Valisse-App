import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Bookmark, Share2, Star, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props { postId: number }

export default function PostDetail({ postId }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.posts.getById.useQuery({ postId });
  const utils = trpc.useUtils();

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
  const imageUrl = post.imageUrls?.[0];

  const handleBook = () => {
    if (!isAuthenticated) { toast.error("Sign in to book"); return; }
    navigate(`/book/${tech?.id}?postId=${postId}`);
  };

  const handleMessage = () => {
    if (!isAuthenticated) { toast.error("Sign in to message"); return; }
    if (!tech) return;
    getOrCreateConv.mutate({ techId: tech.id });
  };

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Hero image */}
      <div className="relative">
        {imageUrl ? (
          <img src={imageUrl} alt="nail art" className="w-full object-cover" style={{ maxHeight: "70vh" }} />
        ) : (
          <div className="w-full h-96 bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
            <span className="text-6xl">💅</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Action buttons — save is the primary engagement action */}
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

        {/* Multiple images indicator */}
        {post.imageUrls?.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {post.imageUrls.map((_: string, i: number) => (
              <div key={i} className={cn("h-1.5 rounded-full bg-white transition-all", i === 0 ? "w-4" : "w-1.5 opacity-60")} />
            ))}
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
            onClick={() => navigate(`/tech/${tech.id}`)}
          >
            <Avatar className="w-14 h-14 border-2 border-border">
              <AvatarImage src={tech.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent text-primary font-semibold">
                {(tech.name ?? "N").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{tech.businessName || tech.name}</p>
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
            <ChevronRight size={18} className="text-muted-foreground" />
          </motion.div>
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
            Book This Look
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
