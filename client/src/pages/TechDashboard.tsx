import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Eye, Heart, TrendingUp, Clock, Edit2, Trash2, Bell, BarChart2, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TechDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotNote, setSlotNote] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "posts" | "slots">("overview");

  const { data: analytics } = trpc.analytics.techAnalytics.useQuery(undefined, { enabled: isAuthenticated });
  const { data: postsData, refetch: refetchPosts } = trpc.posts.myPosts.useQuery(undefined, { enabled: isAuthenticated });
  const { data: slots, refetch: refetchSlots } = trpc.lastMinute.mySlots.useQuery(undefined, { enabled: isAuthenticated });
  const { data: subscription } = trpc.subscriptions.mySubscription.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const deletePost = trpc.posts.delete.useMutation({
    onSuccess: () => { refetchPosts(); toast.success("Post removed"); },
  });

  const createSlot = trpc.lastMinute.create.useMutation({
    onSuccess: () => {
      setShowSlotDialog(false);
      setSlotDate(""); setSlotTime(""); setSlotNote("");
      refetchSlots();
      toast.success("Last-minute slot published!");
    },
  });

  const deleteSlot = trpc.lastMinute.delete.useMutation({
    onSuccess: () => { refetchSlots(); toast.success("Slot removed"); },
  });

  const handleCreateSlot = () => {
    if (!slotDate || !slotTime) { toast.error("Please select date and time"); return; }
    const [year, month, day] = slotDate.split("-").map(Number);
    const [hours, minutes] = slotTime.split(":").map(Number);
    const slotDateTime = new Date(year, month - 1, day, hours, minutes).getTime();
    createSlot.mutate({ slotDate: slotDateTime, duration: 60, note: slotNote || undefined });
  };

  if (!isAuthenticated) return null;

  const posts = postsData ?? [];
  const publishedCount = posts.filter(p => p.post.status === "published").length;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#E6F5F1] to-[#F7F4EE] px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-white font-semibold">
                {(user?.name ?? "N").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Welcome back,</p>
              <h1 className="font-semibold text-foreground">{user?.businessName || user?.name}</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/create-post")}
            className="flex items-center gap-1.5 btn-valisse px-4 py-2 text-sm"
          >
            <Plus size={15} /> Post
          </button>
        </div>

        {/* Subscription status */}
        {subscription && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs",
            subscription.status === "trial" ? "bg-accent text-accent-foreground border border-border" :
            subscription.status === "active" ? "bg-primary/10 text-primary border border-primary/20" :
            "bg-muted text-muted-foreground border border-border"
          )}>
            <Zap size={12} />
            <span className="font-medium capitalize">{subscription.status === "trial" ? "Free Trial" : subscription.tier}</span>
            {subscription.status === "trial" && subscription.trialEndsAt && (
              <span className="ml-auto opacity-70">
                Ends {new Date(subscription.trialEndsAt as any).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            {subscription.status === "expired" && (
              <button onClick={() => navigate("/subscription")} className="ml-auto font-semibold">
                Renew →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {(["overview", "posts", "slots"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-sm font-medium capitalize transition-all border-b-2 -mb-px",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >{tab === "slots" ? "Last-Minute" : tab}</button>
        ))}
      </div>

      <div className="px-4 py-4 pb-24">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Analytics cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Eye size={18} className="text-primary" />} label="Total Views" value={analytics?.totalViews ?? 0} />
              <StatCard icon={<Heart size={18} className="text-primary" />} label="Total Likes" value={analytics?.totalLikes ?? 0} />
              <StatCard icon={<TrendingUp size={18} className="text-primary" />} label="Bookings" value={analytics?.totalBookings ?? 0} />
              <StatCard
                icon={<BarChart2 size={18} className="text-primary" />}
                label="Booking Rate"
                value={`${analytics?.bookingRate ?? 0}%`}
              />
            </div>

            {/* Quick stats */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">Portfolio Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Published posts</span>
                <span className="font-medium">{publishedCount}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Open slots</span>
                <span className="font-medium">{slots?.length ?? 0}</span>
              </div>
            </div>

            {/* Recent posts preview */}
            {posts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Recent Posts</h3>
                  <button onClick={() => setActiveTab("posts")} className="text-xs text-primary">See all</button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {posts.slice(0, 6).map(({ post }) => (
                    <div key={post.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
                      {post.imageUrls?.[0] ? (
                        <img src={post.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
                          <span className="text-xl">💅</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Posts tab */}
        {activeTab === "posts" && (
          <div className="space-y-3">
            <button onClick={() => navigate("/create-post")} className="w-full btn-valisse py-3 flex items-center justify-center gap-2">
              <Plus size={16} /> Create New Post
            </button>
            {posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No posts yet. Share your first nail art!
              </div>
            ) : (
              posts.map(({ post, analytics: pa }) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden"
                >
                  <div className="flex gap-3 p-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      {post.imageUrls?.[0] ? (
                        <img src={post.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
                          <span className="text-2xl">💅</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium truncate">{post.caption || "Untitled"}</p>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize ml-2 flex-shrink-0",
                          post.status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>{post.status}</span>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye size={11} />{pa?.views ?? 0}</span>
                        <span className="flex items-center gap-1"><Heart size={11} />{pa?.likes ?? 0}</span>
                        <span className="flex items-center gap-1"><TrendingUp size={11} />{pa?.bookingsFromPost ?? 0}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => navigate(`/edit-post/${post.id}`)} className="flex items-center gap-1 text-xs text-primary">
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          onClick={() => deletePost.mutate({ postId: post.id })}
                          className="flex items-center gap-1 text-xs text-destructive"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Last-Minute Slots tab */}
        {activeTab === "slots" && (
          <div className="space-y-3">
            <div className="bg-accent/50 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-start gap-3">
                <Bell size={18} className="text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Last-Minute Openings</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Publish available slots to notify nearby clients and past customers instantly.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSlotDialog(true)}
              className="w-full btn-valisse py-3 flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add Last-Minute Slot
            </button>

            {!slots || slots.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No open slots. Add one to attract last-minute bookings!
              </div>
            ) : (
              slots.map(slot => (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Clock size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {new Date(slot.slotDate as any).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(slot.slotDate as any).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · {slot.duration} min
                    </p>
                    {slot.note && <p className="text-xs text-muted-foreground mt-0.5">{slot.note}</p>}
                  </div>
                  <button
                    onClick={() => deleteSlot.mutate({ id: slot.id })}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-xl">Add Last-Minute Slot</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time</label>
              <Input type="time" value={slotTime} onChange={e => setSlotTime(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
              <Input placeholder="e.g. Gel manicure available" value={slotNote} onChange={e => setSlotNote(e.target.value)} className="rounded-xl h-11" />
            </div>
            <button onClick={handleCreateSlot} disabled={createSlot.isPending} className="btn-valisse py-3 mt-1">
              {createSlot.isPending ? "Publishing..." : "Publish Slot"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
