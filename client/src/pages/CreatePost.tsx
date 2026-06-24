import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, ImagePlus, X, Plus, ChevronDown, Layers, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STYLE_TAG_GROUPS, NAIL_COLORS, MAX_STYLE_TAGS } from "@shared/const";

const SHAPES = ["Square", "Round", "Oval", "Almond", "Stiletto", "Coffin", "Ballerina"];

const SERVICE_CATEGORIES = [
  "Gel", "Acrylic", "Dip Powder", "Nail Art", "Manicure", "Pedicure", "Extensions", "Press-On", "Other"
];

interface Props { postId?: number }

export default function CreatePost({ postId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEditing = !!postId;

  const [images, setImages] = useState<{ file?: File; preview: string; url?: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [shape, setShape] = useState("");
  // Multi-color: array of selected colors
  const [colors, setColors] = useState<string[]>([]);
  const [location, setLocation] = useState(user?.location ?? "");
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);

  // Service linking
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showInlineServiceForm, setShowInlineServiceForm] = useState(false);
  // Inline service creation fields
  const [newServiceCategory, setNewServiceCategory] = useState("Gel");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("60");
  const [creatingService, setCreatingService] = useState(false);

  const utils = trpc.useUtils();

  const { data: myServices } = trpc.settings.getServices.useQuery(undefined, {
    enabled: !!user && user.userType === "nail_tech",
  });

  const upsertService = trpc.settings.upsertService.useMutation({
    onSuccess: () => {
      utils.settings.getServices.invalidate();
      toast.success("Service created!");
    },
  });

  // Load existing post data when editing
  const { data: postsData } = trpc.posts.myPosts.useQuery(undefined, { enabled: isEditing });
  useEffect(() => {
    if (!isEditing || !postsData) return;
    const found = postsData.find((p: any) => p.post.id === postId);
    if (!found) return;
    const { post } = found;
    setCaption(post.caption ?? "");
    const rawStyle = post.style ?? "";
    if (rawStyle) {
      try {
        const parsed = JSON.parse(rawStyle);
        setStyleTags(Array.isArray(parsed) ? parsed : [rawStyle]);
      } catch {
        setStyleTags([rawStyle]);
      }
    }
    setShape(post.shape ?? "");
    // Load colors
    if (post.colors) {
      try {
        const parsed = typeof post.colors === "string" ? JSON.parse(post.colors) : post.colors;
        setColors(Array.isArray(parsed) ? parsed : (post.color ? [post.color] : []));
      } catch { setColors(post.color ? [post.color] : []); }
    } else if (post.color) {
      setColors([post.color]);
    }
    setLocation(post.location ?? "");
    if (post.serviceId) setSelectedServiceId(post.serviceId);
    setImages((post.imageUrls ?? []).map((url: string) => ({ preview: url, url })));
    setLoaded(true);
  }, [postsData, postId, isEditing]);

  const uploadImage = trpc.posts.uploadImage.useMutation();
  const createPost = trpc.posts.create.useMutation({
    onSuccess: () => { toast.success("Post published!"); navigate("/dashboard"); },
    onError: () => toast.error("Failed to publish post"),
  });
  const updatePost = trpc.posts.update.useMutation({
    onSuccess: () => { toast.success("Post updated!"); navigate("/dashboard"); },
    onError: () => toast.error("Failed to update post"),
  });

  const toggleStyleTag = (tag: string) => {
    setStyleTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= MAX_STYLE_TAGS) {
        toast.error(`Max ${MAX_STYLE_TAGS} style tags per post`);
        return prev;
      }
      return [...prev, tag];
    });
  };

  const toggleColor = (c: string) => {
    setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length + images.length > 5) { toast.error("Max 5 images per post"); return; }
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      setImages(prev => [...prev, { file, preview }]);
    }
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleCreateServiceInline = async () => {
    const name = newServiceName.trim() || newServiceCategory;
    const price = parseFloat(newServicePrice);
    const duration = parseInt(newServiceDuration, 10);
    if (!name) { toast.error("Enter a service name"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }
    if (isNaN(duration) || duration < 5) { toast.error("Enter a valid duration"); return; }
    setCreatingService(true);
    try {
      const result = await upsertService.mutateAsync({
        category: newServiceCategory,
        customName: newServiceName.trim() || undefined,
        priceInCents: Math.round(price * 100),
        durationMinutes: duration,
      });
      setSelectedServiceId((result as any).id);
      setShowInlineServiceForm(false);
      setShowServicePicker(false);
      toast.success("Service created and linked!");
    } catch {
      toast.error("Failed to create service");
    } finally {
      setCreatingService(false);
    }
  };

  const handlePublish = async () => {
    if (images.length === 0) { toast.error("Add at least one image"); return; }
    if (!selectedServiceId) { toast.error("Link a service to this post"); return; }
    setUploading(true);
    const styleValue = styleTags.length > 0 ? JSON.stringify(styleTags) : undefined;
    try {
      const uploadedUrls: string[] = [];
      for (const img of images) {
        if (img.url && !img.file) { uploadedUrls.push(img.url); continue; }
        if (!img.file) continue;
        const base64 = await fileToBase64(img.file);
        const result = await uploadImage.mutateAsync({ base64, mimeType: img.file.type, filename: img.file.name });
        uploadedUrls.push(result.url);
      }
      if (isEditing && postId) {
        await updatePost.mutateAsync({
          postId,
          caption: caption || undefined,
          style: styleValue,
          shape: shape || undefined,
          color: colors[0] || undefined,
          colors: colors.length > 0 ? colors : undefined,
          location: location || undefined,
          status: "published",
        });
      } else {
        await createPost.mutateAsync({
          imageUrls: uploadedUrls,
          serviceId: selectedServiceId,
          caption: caption || undefined,
          style: styleValue,
          styles: styleTags.length > 0 ? styleTags : undefined,
          shape: shape || undefined,
          color: colors[0] || undefined,
          colors: colors.length > 0 ? colors : undefined,
          location: location || undefined,
        });
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const selectedService = myServices?.find((s: any) => s.id === selectedServiceId);
  const isMultiColor = colors.length >= 2;

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 font-semibold text-foreground">{isEditing ? "Edit Post" : "New Post"}</h1>
        <button
          onClick={handlePublish}
          disabled={images.length === 0 || !selectedServiceId || uploading || createPost.isPending || updatePost.isPending}
          className="btn-valisse px-5 py-2 text-sm disabled:opacity-50"
        >
          {uploading || createPost.isPending || updatePost.isPending ? "Saving..." : isEditing ? "Save" : "Publish"}
        </button>
      </div>

      <div className="px-4 py-5 pb-24 space-y-6">
        {/* Image upload */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Photos</p>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {images.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden bg-muted">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeImage(idx)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X size={12} />
                </button>
                {idx === 0 && <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full">Cover</div>}
              </div>
            ))}
            {images.length < 5 && (
              <button onClick={() => fileRef.current?.click()} className="flex-shrink-0 w-28 h-28 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 transition-colors">
                <ImagePlus size={22} />
                <span className="text-xs">Add Photo</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        </div>

        {/* Service Link — required */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Service <span className="text-destructive">*</span>
            </p>
            <span className="text-[10px] text-muted-foreground">Required — clients book this service from your post</span>
          </div>

          {selectedService ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Briefcase size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedService.customName || selectedService.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${(selectedService.priceInCents / 100).toFixed(0)} · {selectedService.durationMinutes} min
                </p>
              </div>
              <button
                onClick={() => { setSelectedServiceId(null); setShowServicePicker(true); }}
                className="text-xs text-primary font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowServicePicker(v => !v)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm",
                showServicePicker
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-dashed border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="flex items-center gap-2">
                <Briefcase size={15} />
                Link a service to this post
              </span>
              <ChevronDown size={14} className={cn("transition-transform", showServicePicker && "rotate-180")} />
            </button>
          )}

          {/* Service picker dropdown */}
          {showServicePicker && !selectedService && (
            <div className="mt-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {myServices && myServices.length > 0 ? (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-3 pb-1">Your Services</p>
                  {myServices.filter((s: any) => s.isActive).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedServiceId(s.id); setShowServicePicker(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.customName || s.category}</p>
                        <p className="text-xs text-muted-foreground">${(s.priceInCents / 100).toFixed(0)} · {s.durationMinutes} min</p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-border" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground px-3 py-3">No services set up yet. Create one below.</p>
              )}

              {/* Inline service creation */}
              {!showInlineServiceForm ? (
                <button
                  onClick={() => setShowInlineServiceForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-3 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                >
                  <Plus size={14} />
                  Create a new service
                </button>
              ) : (
                <div className="px-3 py-3 space-y-3 border-t border-border">
                  <p className="text-xs font-semibold text-foreground">New Service</p>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SERVICE_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setNewServiceCategory(cat)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs border transition-all",
                            newServiceCategory === cat
                              ? "bg-primary text-white border-primary"
                              : "bg-background border-border text-foreground"
                          )}
                        >{cat}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Custom name (optional)</p>
                    <Input
                      placeholder={`e.g. ${newServiceCategory} with Nail Art`}
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                      className="h-9 text-sm rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Price ($)</p>
                      <Input
                        type="number"
                        placeholder="45"
                        value={newServicePrice}
                        onChange={e => setNewServicePrice(e.target.value)}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Duration (min)</p>
                      <Input
                        type="number"
                        placeholder="60"
                        value={newServiceDuration}
                        onChange={e => setNewServiceDuration(e.target.value)}
                        step={5}
                        min={5}
                        max={360}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowInlineServiceForm(false)}
                      className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground"
                    >Cancel</button>
                    <button
                      onClick={handleCreateServiceInline}
                      disabled={creatingService}
                      className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                    >
                      {creatingService ? "Creating…" : "Create & Link"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Caption */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Caption</p>
          <Textarea placeholder="Describe this nail look..." value={caption} onChange={e => setCaption(e.target.value)} className="rounded-xl resize-none" rows={3} />
        </div>

        {/* Style Tags — grouped, multi-select, max 3 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</p>
            <span className={cn(
              "text-xs font-medium transition-colors",
              styleTags.length === MAX_STYLE_TAGS ? "text-primary" : "text-muted-foreground"
            )}>
              {styleTags.length}/{MAX_STYLE_TAGS} selected
            </span>
          </div>
          {styleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {styleTags.map(tag => (
                <button key={tag} onClick={() => toggleStyleTag(tag)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-medium">
                  {tag}<X size={10} />
                </button>
              ))}
            </div>
          )}
          <div className="space-y-4">
            {STYLE_TAG_GROUPS.map(({ group, tags }) => (
              <div key={group}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const selected = styleTags.includes(tag);
                    const maxed = !selected && styleTags.length >= MAX_STYLE_TAGS;
                    return (
                      <button key={tag} onClick={() => toggleStyleTag(tag)} disabled={maxed}
                        className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                          selected ? "bg-primary text-white border-primary"
                            : maxed ? "bg-card border-border text-muted-foreground/40 cursor-not-allowed"
                              : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                        )}>{tag}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shape */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Shape</p>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map(o => (
              <button key={o} onClick={() => setShape(shape === o ? "" : o)}
                className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                  shape === o ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                )}>{o}</button>
            ))}
          </div>
        </div>

        {/* Color — multi-select, auto Multi-Color */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Colors</p>
            {isMultiColor && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Layers size={11} />
                Multi-Color
              </span>
            )}
          </div>
          {colors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {colors.map(c => (
                <button key={c} onClick={() => toggleColor(c)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-medium">
                  {c}<X size={10} />
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {NAIL_COLORS.map(c => {
              const selected = colors.includes(c);
              return (
                <button key={c} onClick={() => toggleColor(c)}
                  className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                    selected ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                  )}>{c}</button>
              );
            })}
          </div>
          {isMultiColor && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Layers size={10} />
              This post will appear in Multi-Color search results
            </p>
          )}
        </div>

        {/* Location */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Location</p>
          <Input placeholder="City, State" value={location} onChange={e => setLocation(e.target.value)} className="rounded-xl h-11" />
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
