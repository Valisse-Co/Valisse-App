import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Camera, ChevronRight, MapPin, Settings, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ClientProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>((user as any)?.avatarUrl ?? null);

  const uploadAvatar = trpc.settings.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarPreview(data.url);
      utils.auth.me.invalidate();
      toast.success("Profile photo updated");
    },
    onError: (error) => toast.error(error.message || "We couldn't upload that photo."),
  });

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    try {
      const base64 = await fileToBase64(file);
      uploadAvatar.mutate({ base64, mimeType: file.type });
    } catch {
      toast.error("We couldn't read that photo. Please try another image.");
    }
  };

  const initials = (user?.name || "Valisse Member")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Your account</p>
        <h1 className="font-display text-3xl font-light text-foreground mt-1">Profile</h1>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar className="w-20 h-20 border-2 border-primary/15">
            <AvatarImage src={avatarPreview ?? undefined} alt={user?.name || "Profile photo"} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            aria-label="Change profile photo"
            onClick={() => inputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center shadow-sm disabled:opacity-60"
          >
            <Camera size={14} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">{user?.name || "Valisse Member"}</h2>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="text-sm text-primary font-medium mt-1.5">
            {uploadAvatar.isPending ? "Uploading…" : "Add or change photo"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        <button type="button" onClick={() => navigate("/settings/profile")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><UserRound size={18} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground">Personal details</span>
            <span className="block text-xs text-muted-foreground truncate">Name, phone number, and location</span>
          </span>
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>
        <button type="button" onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Settings size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">Settings</span>
            <span className="block text-xs text-muted-foreground">Privacy, notifications, appearance, and account</span>
          </span>
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>
      </section>

      {user?.location && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <MapPin size={16} className="text-primary" />
          <span>{user.location}</span>
        </div>
      )}
    </div>
  );
}
