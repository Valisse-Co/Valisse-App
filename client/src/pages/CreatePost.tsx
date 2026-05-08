import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STYLES = ["Minimalist", "Bold", "Floral", "Geometric", "Glam", "Natural", "Abstract", "French"];
const SHAPES = ["Square", "Round", "Oval", "Almond", "Stiletto", "Coffin", "Ballerina"];
const COLORS = ["Nude", "White", "Black", "Pink", "Red", "Blue", "Green", "Purple", "Gold", "Multicolor"];

interface Props { postId?: number }

export default function CreatePost({ postId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEditing = !!postId;

  const [images, setImages] = useState<{ file?: File; preview: string; url?: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [style, setStyle] = useState("");
  const [shape, setShape] = useState("");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState(user?.location ?? "");
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);

  // Load existing post data when editing
  const { data: postsData } = trpc.posts.myPosts.useQuery(undefined, { enabled: isEditing });
  useEffect(() => {
    if (!isEditing || !postsData) return;
    const found = postsData.find(p => p.post.id === postId);
    if (!found) return;
    const { post } = found;
    setCaption(post.caption ?? "");
    setStyle(post.style ?? "");
    setShape(post.shape ?? "");
    setColor(post.color ?? "");
    setLocation(post.location ?? "");
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length + images.length > 5) { toast.error("Max 5 images per post"); return; }
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      setImages(prev => [...prev, { file, preview }]);
    }
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handlePublish = async () => {
    if (images.length === 0) { toast.error("Add at least one image"); return; }
    setUploading(true);
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
          style: style || undefined,
          shape: shape || undefined,
          color: color || undefined,
          location: location || undefined,
          status: "published",
        });
      } else {
        await createPost.mutateAsync({
          imageUrls: uploadedUrls,
          caption: caption || undefined,
          style: style || undefined,
          shape: shape || undefined,
          color: color || undefined,
          location: location || undefined,
        });
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

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
          disabled={images.length === 0 || uploading || createPost.isPending || updatePost.isPending}
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

        {/* Caption */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Caption</p>
          <Textarea placeholder="Describe this nail look..." value={caption} onChange={e => setCaption(e.target.value)} className="rounded-xl resize-none" rows={3} />
        </div>

        {/* Tags */}
        {[
          { label: "Style", options: STYLES, value: style, set: setStyle },
          { label: "Shape", options: SHAPES, value: shape, set: setShape },
          { label: "Color", options: COLORS, value: color, set: setColor },
        ].map(({ label, options, value, set }) => (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
            <div className="flex flex-wrap gap-2">
              {options.map(o => (
                <button key={o} onClick={() => set(value === o ? "" : o)}
                  className={cn("px-3 py-1.5 rounded-full text-xs border transition-all",
                    value === o ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                  )}>{o}</button>
              ))}
            </div>
          </div>
        ))}

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
