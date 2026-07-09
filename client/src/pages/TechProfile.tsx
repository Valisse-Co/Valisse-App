import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, MapPin, Star, MessageCircle, Calendar, Instagram, Clock, DollarSign, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

interface Props { techId: number }

export default function TechProfile({ techId }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const fromPath = new URLSearchParams(search).get("from");
  const [activeTab, setActiveTab] = useState<"portfolio" | "reviews" | "schedule">("portfolio");

  const { data: profileData, isLoading } = trpc.users.getProfile.useQuery({ userId: techId });
  const { data: postsData } = trpc.posts.techPosts.useQuery({ techId });
  const { data: reviewsData } = trpc.reviews.techReviews.useQuery({ techId });
  const { data: techServices = [] } = trpc.settings.getServicesByTechId.useQuery({ techId });
  const { data: scheduleData = [] } = trpc.availability.get.useQuery({ techId });
  const { data: followData, refetch: refetchFollow } = trpc.techFollows.isFollowing.useQuery(
    { techId },
    { enabled: isAuthenticated }
  );
  const { data: followerCountData, refetch: refetchFollowerCount } = trpc.techFollows.followerCount.useQuery({ techId });

  const followMutation = trpc.techFollows.follow.useMutation({
    onSuccess: () => { refetchFollow(); refetchFollowerCount(); toast.success("Subscribed!"); },
    onError: () => toast.error("Could not subscribe"),
  });
  const unfollowMutation = trpc.techFollows.unfollow.useMutation({
    onSuccess: () => { refetchFollow(); refetchFollowerCount(); toast.success("Unsubscribed"); },
    onError: () => toast.error("Could not unsubscribe"),
  });

  const isFollowing = followData?.following ?? false;
  const subscriberCount = followerCountData?.count ?? 0;

  const handleToggleFollow = () => {
    if (!isAuthenticated) { toast.error("Sign in to subscribe"); return; }
    if (isFollowing) unfollowMutation.mutate({ techId });
    else followMutation.mutate({ techId });
  };

  const getOrCreateConv = trpc.messaging.getOrCreateConversation.useMutation({
    onSuccess: (conv) => navigate(`/chat/${conv.id}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profileData) return <div className="p-8 text-center text-muted-foreground">Profile not found</div>;

  const { user: tech, ratingStats, followerCount } = profileData;

  const handleMessage = () => {
    if (!isAuthenticated) { toast.error("Sign in to message"); return; }
    getOrCreateConv.mutate({ techId });
  };

  const handleBook = (serviceId?: number) => {
    if (!isAuthenticated) { toast.error("Sign in to book"); return; }
    if (serviceId) navigate(`/book/${techId}?serviceId=${serviceId}`);
    else navigate(`/book/${techId}`);
  };

  const posts = postsData?.filter(p => p.post.status === "published") ?? [];
  const reviews = reviewsData ?? [];

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="relative">
        {/* Cover gradient */}
        <div className="h-32 bg-gradient-to-br from-[#0F8F6F]/20 via-[#E6F5F1] to-[#D0EDE6]" />

        <button
          onClick={() => navigate(fromPath || "/discover")}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Avatar */}
        <div className="px-5 -mt-10 pb-4">
          <Avatar className="w-20 h-20 border-4 border-background shadow-md">
            <AvatarImage src={tech.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-accent text-primary text-2xl font-semibold">
              {(tech.name ?? "N").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{tech.businessName || tech.name}</h1>
            {tech.businessName && tech.name && (
              <p className="text-sm text-muted-foreground">{tech.name}</p>
            )}
          </div>
          {tech.instagramHandle && (
            <a
              href={`https://instagram.com/${tech.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Instagram size={20} />
            </a>
          )}
        </div>

        {/* Location & Rating */}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {tech.location && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin size={13} />{tech.location}
            </span>
          )}
          {ratingStats && ratingStats.count > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <Star size={13} className="text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{ratingStats.average.toFixed(1)}</span>
              <span className="text-muted-foreground">({ratingStats.count} reviews)</span>
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <p className="text-lg font-semibold">{posts.length}</p>
            <p className="text-xs text-muted-foreground">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{subscriberCount}</p>
            <p className="text-xs text-muted-foreground">Subscribers</p>
          </div>
          {reviews.length > 0 && (
            <div className="text-center">
              <p className="text-lg font-semibold">{reviews.length}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          )}
        </div>

        {/* Bio */}
        {tech.bio && (
          <p className="mt-4 text-sm text-foreground leading-relaxed">{tech.bio}</p>
        )}

        {/* Services offered */}
        {techServices.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold mb-2">Services</h3>
            <div className="flex flex-col gap-2">
              {techServices.map((svc) => {
                const displayName = svc.customName || svc.category;
                const price = svc.priceInCents > 0 ? `$${(svc.priceInCents / 100).toFixed(0)}` : "Free";
                const h = Math.floor(svc.durationMinutes / 60);
                const m = svc.durationMinutes % 60;
                const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
                return (
                  <motion.button
                    key={svc.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleBook(svc.id)}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 text-left w-full hover:border-primary/40 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {svc.photoUrl ? (
                        <img src={svc.photoUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-primary font-medium">
                          <DollarSign size={11} />{price.replace("$", "")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={11} />{dur}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-3 mt-5">
          {/* Subscribe / Unsubscribe */}
          {user?.id !== techId && (
            <button
              onClick={handleToggleFollow}
              disabled={followMutation.isPending || unfollowMutation.isPending}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                isFollowing
                  ? "bg-primary/10 text-primary border border-primary/30 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isFollowing ? <BellOff size={16} /> : <Bell size={16} />}
              {isFollowing ? "Subscribed" : "Subscribe"}
            </button>
          )}
          <button onClick={handleMessage} className="flex-1 btn-valisse-outline py-3 flex items-center justify-center gap-2">
            <MessageCircle size={16} />
            Message
          </button>
          <button onClick={() => handleBook()} className="flex-1 btn-valisse py-3 flex items-center justify-center gap-2">
            <Calendar size={16} />
            Book a Look
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        {(["portfolio", "reviews", "schedule"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-sm font-medium capitalize transition-all border-b-2 -mb-px",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Portfolio grid */}
      {activeTab === "portfolio" && (
        <div className="p-3 pb-24">
          {posts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No posts yet</div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(({ post }) => (
                <motion.div
                  key={post.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-muted"
                >
                  {post.imageUrls?.[0] ? (
                    <img src={post.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
                      <span className="text-2xl">💅</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule */}
      {activeTab === "schedule" && (
        <div className="px-5 py-4 pb-24">
          {scheduleData.filter((s: any) => s.isActive).length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <Calendar size={32} className="mx-auto mb-3 opacity-30" />
              <p>No schedule posted yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((dayName, idx) => {
                const row = (scheduleData as any[]).find((s: any) => Number(s.dayOfWeek) === idx);
                const isOpen = row?.isActive;
                const fmt = (t: string) => {
                  if (!t) return "";
                  const [h, m] = t.split(":").map(Number);
                  const ampm = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 || 12;
                  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
                };
                return (
                  <div
                    key={dayName}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl border",
                      isOpen ? "bg-card border-border" : "bg-muted/40 border-border/50"
                    )}
                  >
                    <span className={cn("text-sm font-medium w-28", !isOpen && "text-muted-foreground")}>{dayName}</span>
                    {isOpen ? (
                      <div className="text-right">
                        <span className="text-sm text-foreground">
                          {fmt(row.startTime)} – {fmt(row.endTime)}
                        </span>
                        {row.breakStart && row.breakEnd && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Break {fmt(row.breakStart)} – {fmt(row.breakEnd)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      {activeTab === "reviews" && (
        <div className="px-4 py-4 pb-24 space-y-4">
          {reviews.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No reviews yet</div>
          ) : (
            reviews.map(({ review, client }) => (
              <div key={review.id} className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-accent text-primary text-sm">
                      {(client?.name ?? "C").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{client?.name ?? "Client"}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={11} className={cn(i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted")} />
                      ))}
                    </div>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.text && <p className="text-sm text-foreground leading-relaxed">{review.text}</p>}
                {review.photoUrl && (
                  <img src={review.photoUrl} alt="review" className="mt-3 w-full rounded-xl object-cover max-h-40" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
