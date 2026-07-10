import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Eye, Bookmark, TrendingUp, Clock, Edit2, Trash2, Bell, BarChart2, Zap, EyeOff, RotateCcw, AlertTriangle, DollarSign, Image as ImageIcon, Pencil, Upload, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { useRef } from "react";
import { ScheduleTab } from "./TechBookings";

// ─── Service helpers (mirrored from SettingsProfile) ─────────────────────────
type ServiceForm = {
  id?: number;
  category: string;
  customName: string;
  priceInCents: number;
  durationMinutes: number;
  photoUrl?: string;
  photoKey?: string;
};

const SERVICE_CATEGORIES = [
  "Gel Manicure",
  "Structured Gel / Builder Gel",
  "Structured Gel / Builder Gel Fill",
  "Acrylic Full Set",
  "Acrylic Fill",
  "Gel-X / Soft Gel Extensions",
  "Dip Powder",
  "Manicure",
  "Pedicure",
  "Nail Art / Add-Ons",
  "Removal / Soak-Off",
  "Repair",
  "Press-On Nails",
  "Custom / Not Sure",
];

const DURATION_OPTIONS = Array.from({ length: 72 }, (_, i) => {
  const mins = (i + 1) * 5;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { value: mins, label: h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m` };
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DashServiceCard({ service, onEdit, onDelete }: { service: ServiceForm; onEdit: () => void; onDelete: () => void }) {
  const displayName = service.customName || service.category;
  const price = service.priceInCents > 0 ? `$${(service.priceInCents / 100).toFixed(0)}` : "Free";
  const dur = DURATION_OPTIONS.find((d) => d.value === service.durationMinutes)?.label ?? `${service.durationMinutes}m`;
  return (
    <div className="flex items-center gap-3 bg-background border border-border rounded-xl p-3">
      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {service.photoUrl ? (
          <img src={service.photoUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon size={16} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-primary font-medium">{price}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{dur}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-destructive">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function DashServiceDialog({ open, initial, onSave, onClose, isLoading }: {
  open: boolean; initial: ServiceForm | null; onSave: (form: ServiceForm & { _pendingPhotoBase64?: string }) => void;
  onClose: () => void; isLoading: boolean;
}) {
  const [form, setForm] = useState<ServiceForm>(initial ?? { category: "Gel Manicure", customName: "", priceInCents: 5500, durationMinutes: 60 });
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = trpc.settings.uploadServicePhoto.useMutation({
    onSuccess: (data) => setForm((f) => ({ ...f, photoUrl: data.url, photoKey: data.key })),
  });
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPendingPhotoBase64(await fileToBase64(file));
  };
  const handleSave = async () => {
    let finalForm = { ...form };
    if (pendingPhotoBase64 && form.id) {
      const result = await uploadPhoto.mutateAsync({ serviceId: form.id, base64: pendingPhotoBase64, mimeType: "image/jpeg" });
      finalForm = { ...finalForm, photoUrl: result.url, photoKey: result.key };
    }
    onSave({ ...finalForm, _pendingPhotoBase64: pendingPhotoBase64 } as any);
  };
  const priceDisplay = form.priceInCents > 0 ? (form.priceInCents / 100).toFixed(0) : "";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader><DialogTitle className="font-display font-light text-xl">{initial?.id ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed border-border hover:border-primary/50 transition" onClick={() => fileRef.current?.click()}>
              {photoPreview ? <img src={photoPreview} alt="Service" className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground"><Upload size={18} /><span className="text-[10px]">Add photo</span></div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-muted-foreground flex-1">Upload a photo of this service as an example for clients</p>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Service Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SERVICE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Display Name (optional)</Label>
            <Input placeholder='e.g. "Glitter Gel Set"' value={form.customName} onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Price</Label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="number" min={0} placeholder="55" className="pl-8" value={priceDisplay}
                onChange={(e) => setForm((f) => ({ ...f, priceInCents: Math.round(parseFloat(e.target.value || "0") * 100) }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Duration</Label>
            <Select value={String(form.durationMinutes)} onValueChange={(v) => setForm((f) => ({ ...f, durationMinutes: parseInt(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-48">{DURATION_OPTIONS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !form.category}>{isLoading ? "Saving…" : "Save Service"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TechDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("09:00");
  const [slotEndTime, setSlotEndTime] = useState("10:00");
  const [slotNote, setSlotNote] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "posts" | "slots" | "smartmatch">("overview");

  const { data: analytics } = trpc.analytics.techAnalytics.useQuery(undefined, { enabled: isAuthenticated });
  const { data: postsData, refetch: refetchPosts } = trpc.posts.myPosts.useQuery(undefined, { enabled: isAuthenticated });
  const { data: slots, refetch: refetchSlots } = trpc.lastMinute.mySlots.useQuery(undefined, { enabled: isAuthenticated });
  const { data: subscription } = trpc.subscriptions.mySubscription.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  // Smart Match configs
  const { data: smConfigs, refetch: refetchSmConfigs } = trpc.smartMatch.getAllConfigs.useQuery(undefined, { enabled: isAuthenticated });
  const upsertSmConfig = trpc.smartMatch.upsertConfig.useMutation({
    onSuccess: () => { refetchSmConfigs(); toast.success("Smart Match config saved"); },
    onError: (e) => toast.error(e.message),
  });

  // Services
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceForm | null>(null);
  const { data: services = [], refetch: refetchServices } = trpc.settings.getServices.useQuery(undefined, { enabled: isAuthenticated });
  const upsertService = trpc.settings.upsertService.useMutation({
    onSuccess: () => { refetchServices(); setServiceDialogOpen(false); setEditingService(null); toast.success("Service saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteService = trpc.settings.deleteService.useMutation({
    onSuccess: () => { refetchServices(); toast.success("Service removed"); },
    onError: (e) => toast.error(e.message),
  });
  const uploadServicePhoto = trpc.settings.uploadServicePhoto.useMutation();
  const handleSaveService = async (form: ServiceForm & { _pendingPhotoBase64?: string }) => {
    const { _pendingPhotoBase64, ...serviceData } = form;
    const result = await upsertService.mutateAsync({
      id: serviceData.id, category: serviceData.category,
      customName: serviceData.customName || undefined,
      priceInCents: serviceData.priceInCents, durationMinutes: serviceData.durationMinutes,
      photoUrl: serviceData.photoUrl, photoKey: serviceData.photoKey,
    });
    if (_pendingPhotoBase64 && result.id) {
      await uploadServicePhoto.mutateAsync({ serviceId: result.id, base64: _pendingPhotoBase64, mimeType: "image/jpeg" });
      refetchServices();
    }
  };

  const [managePostId, setManagePostId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const hidePost = trpc.posts.hide.useMutation({
    onSuccess: () => { setManagePostId(null); refetchPosts(); toast.success("Post hidden from public feed"); },
    onError: () => toast.error("Failed to hide post"),
  });

  const deletePermanently = trpc.posts.deletePermanently.useMutation({
    onSuccess: () => { setConfirmDeleteId(null); setManagePostId(null); refetchPosts(); toast.success("Post permanently deleted"); },
    onError: () => toast.error("Failed to delete post"),
  });

  const restorePost = trpc.posts.restore.useMutation({
    onSuccess: () => { refetchPosts(); toast.success("Post restored to feed"); },
    onError: () => toast.error("Failed to restore post"),
  });

  const createSlot = trpc.lastMinute.create.useMutation({
    onSuccess: () => {
      setShowSlotDialog(false);
      setSlotDate(""); setSlotStartTime("09:00"); setSlotEndTime("10:00"); setSlotNote("");
      refetchSlots();
      toast.success("Last-minute slot published!");
    },
  });

  const deleteSlot = trpc.lastMinute.delete.useMutation({
    onSuccess: () => { refetchSlots(); toast.success("Slot removed"); },
  });

  const to12h = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`; };

  const handleCreateSlot = () => {
    if (!slotDate || !slotStartTime || !slotEndTime) { toast.error("Please select date and time range"); return; }
    if (slotStartTime >= slotEndTime) { toast.error("End time must be after start time"); return; }
    createSlot.mutate({ slotDate, startTime: slotStartTime, endTime: slotEndTime, note: slotNote || undefined, isPushed: false });
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
      <div className="flex border-b border-border px-4 overflow-x-auto">
        {(["overview", "posts", "slots", "smartmatch"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-shrink-0 py-3 px-2 text-sm font-medium capitalize transition-all border-b-2 -mb-px",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >{
            tab === "slots" ? "Schedule" :
            tab === "smartmatch" ? "Smart Match" :
            tab
          }</button>
        ))}
      </div>

      <div className="px-4 py-4 pb-24">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Analytics cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Eye size={18} className="text-primary" />} label="Total Views" value={analytics?.totalViews ?? 0} />
              <StatCard icon={<Bookmark size={18} className="text-primary" />} label="Total Saves" value={analytics?.totalSaves ?? 0} />
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

            {/* Services Offered */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Services Offered</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Clients see these when booking</p>
                </div>
                <button
                  onClick={() => { setEditingService(null); setServiceDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {services.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No services yet</p>
                    <p className="text-xs mt-1">Add your first service to start accepting bookings</p>
                    <button
                      onClick={() => { setEditingService(null); setServiceDialogOpen(true); }}
                      className="mt-3 btn-valisse px-4 py-2 text-xs"
                    >
                      + Add Service
                    </button>
                  </div>
                ) : (
                  services.map((svc) => (
                    <DashServiceCard
                      key={svc.id}
                      service={svc as ServiceForm}
                      onEdit={() => { setEditingService(svc as ServiceForm); setServiceDialogOpen(true); }}
                      onDelete={() => deleteService.mutate({ serviceId: svc.id })}
                    />
                  ))
                )}
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
                    <motion.div
                      key={post.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/post/${post.id}?preview=1`)}
                      className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer relative group"
                    >
                      {post.imageUrls?.[0] ? (
                        <img src={post.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
                          <span className="text-xl">💅</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                    </motion.div>
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
                        <span className="flex items-center gap-1"><Bookmark size={11} />{pa?.saves ?? 0}</span>
                        <span className="flex items-center gap-1"><TrendingUp size={11} />{pa?.bookingsFromPost ?? 0}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => navigate(`/post/${post.id}?preview=1`)} className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                          <Eye size={10} /> Client View
                        </button>
                        <button onClick={() => navigate(`/edit-post/${post.id}`)} className="flex items-center gap-1 text-xs text-primary">
                          <Edit2 size={11} /> Edit
                        </button>
                        {post.status === "hidden" ? (
                          <button
                            onClick={() => restorePost.mutate({ postId: post.id })}
                            disabled={restorePost.isPending}
                            className="flex items-center gap-1 text-xs text-primary"
                          >
                            <RotateCcw size={11} /> Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => setManagePostId(post.id)}
                            className="flex items-center gap-1 text-xs text-destructive"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Schedule tab */}
        {activeTab === "slots" && (
          <div className="space-y-5">
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
                      {new Date(`${slot.slotDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {to12h(slot.startTime)} – {to12h(slot.endTime)}
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

            <div className="pt-2 border-t border-border/70">
              <div className="mb-3 px-1">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Weekly Schedule</p>
                <h2 className="text-lg font-display font-light text-foreground">Availability</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your weekly hours, blocked time, and booking rules below.</p>
              </div>
              <div className="-mx-4 -mb-4">
                <ScheduleTab />
              </div>
            </div>
          </div>
        )}

        {/* Smart Match tab */}
        {activeTab === "smartmatch" && (() => {
          const configs = (smConfigs as any[]) ?? [];
          return (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-primary" />
                  <h2 className="font-semibold text-foreground">Smart Service Match</h2>
                </div>
                <p className="text-sm text-muted-foreground">Customize the questionnaire clients see when booking each service category. Toggle categories on or off to control when Smart Match activates.</p>
              </div>
              {configs.map((cfg: any) => (
                <div key={cfg.serviceCategory} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{cfg.serviceCategory}</p>
                    <button
                      onClick={() => upsertSmConfig.mutate({ serviceCategory: cfg.serviceCategory, isEnabled: !cfg.effective?.isEnabled })}
                      className={cn(
                        "relative w-10 h-5 rounded-full transition-colors",
                        cfg.effective?.isEnabled !== false ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        cfg.effective?.isEnabled !== false ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                  {cfg.effective?.isEnabled !== false && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {(cfg.effective?.questions ?? []).map((q: any, i: number) => (
                        <div key={q.id} className="text-xs">
                          <span className="font-medium text-foreground">{i + 1}. {q.text}</span>
                          <span className="text-muted-foreground ml-1">({q.options.join(", ")})</span>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground mt-1">Full question editor coming soon — contact support to customize questions.</p>
                    </div>
                  )}
                </div>
              ))}
              {configs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles size={28} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Loading Smart Match configurations…</p>
                </div>
              )}
            </div>
          );
        })()}
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
              <Input
                type="date"
                value={slotDate}
                min={new Date().toISOString().split("T")[0]}
                max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                onChange={e => setSlotDate(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                <Input type="time" value={slotStartTime} onChange={e => setSlotStartTime(e.target.value)} className="rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                <Input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} className="rounded-xl h-11" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
              <Input placeholder="e.g. Gel manicure available" value={slotNote} onChange={e => setSlotNote(e.target.value)} className="rounded-xl h-11" />
            </div>

            {/* Push option — Stripe coming soon */}
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={14} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Push to All Nearby Clients</p>
                    <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider">Coming Soon</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Reach all Valisse clients within 25 mi · <span className="font-medium text-foreground">$5.00</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1">Stripe payments launching soon. Your free slot still notifies your followers.</p>
                </div>
              </div>
            </div>

            <button onClick={handleCreateSlot} disabled={createSlot.isPending} className="btn-valisse py-3 mt-1">
              {createSlot.isPending ? "Publishing..." : "Publish Slot (Free)"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manage Post modal (Hide / Delete Permanently) ── */}
      <Dialog open={managePostId !== null} onOpenChange={open => { if (!open) setManagePostId(null); }}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-xl">Remove Post</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">Choose how you want to remove this post.</p>
          <div className="flex flex-col gap-3 pt-1">
            {/* Hide option */}
            <button
              onClick={() => managePostId !== null && hidePost.mutate({ postId: managePostId })}
              disabled={hidePost.isPending}
              className="w-full flex items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left hover:bg-muted transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <EyeOff size={16} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Hide</p>
                <p className="text-xs text-muted-foreground mt-0.5">Removed from the public feed. You can restore it anytime from your dashboard.</p>
              </div>
            </button>

            {/* Delete Permanently option */}
            <button
              onClick={() => { setConfirmDeleteId(managePostId); }}
              className="w-full flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left hover:bg-destructive/10 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Trash2 size={16} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Delete Permanently</p>
                <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone. The post and all its data will be removed forever.</p>
              </div>
            </button>

            <button
              onClick={() => setManagePostId(null)}
              className="text-sm text-muted-foreground text-center py-1"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Permanent Delete confirmation ── */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent className="rounded-2xl mx-4 max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <AlertDialogTitle className="font-display font-light text-xl">Delete Forever?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              This post will be permanently deleted and cannot be recovered. All views, saves, and booking history linked to this post will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => confirmDeleteId !== null && deletePermanently.mutate({ postId: confirmDeleteId, confirm: true })}
              disabled={deletePermanently.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl h-11 w-full"
            >
              {deletePermanently.isPending ? "Deleting..." : "Yes, Delete Permanently"}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl h-11 w-full mt-0">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add / Edit Service dialog ── */}
      <DashServiceDialog
        open={serviceDialogOpen}
        initial={editingService}
        onSave={handleSaveService}
        onClose={() => { setServiceDialogOpen(false); setEditingService(null); }}
        isLoading={upsertService.isPending || uploadServicePhoto.isPending}
      />
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
