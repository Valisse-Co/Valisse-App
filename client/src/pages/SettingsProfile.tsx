import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  Camera,
  Plus,
  Trash2,
  GripVertical,
  Upload,
  Clock,
  DollarSign,
  Image as ImageIcon,
  Pencil,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Duration options: 5-min increments, max 6 hours
const DURATION_OPTIONS = Array.from({ length: 72 }, (_, i) => {
  const mins = (i + 1) * 5;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return { value: mins, label };
});

type ServiceForm = {
  id?: number;
  category: string;
  customName: string;
  priceInCents: number;
  durationMinutes: number;
  photoUrl?: string;
  photoKey?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: ServiceForm;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayName = service.customName || service.category;
  const price = service.priceInCents > 0 ? `$${(service.priceInCents / 100).toFixed(0)}` : "Free";
  const dur = DURATION_OPTIONS.find((d) => d.value === service.durationMinutes)?.label ?? `${service.durationMinutes}m`;

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {service.photoUrl ? (
          <img src={service.photoUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon size={20} />
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
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-destructive"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ServiceDialog({
  open,
  initial,
  onSave,
  onClose,
  isLoading,
}: {
  open: boolean;
  initial: ServiceForm | null;
  onSave: (form: ServiceForm) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ServiceForm>(
    initial ?? {
      category: "Gel Manicure",
      customName: "",
      priceInCents: 5500,
      durationMinutes: 60,
    }
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = trpc.settings.uploadServicePhoto.useMutation({
    onSuccess: (data) => {
      setForm((f) => ({ ...f, photoUrl: data.url, photoKey: data.key }));
    },
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    const b64 = await fileToBase64(file);
    setPendingPhotoBase64(b64);
  };

  const handleSave = async () => {
    let finalForm = { ...form };
    if (pendingPhotoBase64 && form.id) {
      // Upload photo first if we have a service id
      const result = await uploadPhoto.mutateAsync({
        serviceId: form.id,
        base64: pendingPhotoBase64,
        mimeType: "image/jpeg",
      });
      finalForm = { ...finalForm, photoUrl: result.url, photoKey: result.key };
    }
    onSave({ ...finalForm, _pendingPhotoBase64: pendingPhotoBase64 } as any);
  };

  const priceDisplay = form.priceInCents > 0 ? (form.priceInCents / 100).toFixed(0) : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed border-border hover:border-primary/50 transition"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Service" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Upload size={18} />
                  <span className="text-[10px]">Add photo</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Upload a photo of this service as an example for clients</p>
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs mb-1.5 block">Service Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom name */}
          <div>
            <Label className="text-xs mb-1.5 block">Display Name (optional)</Label>
            <Input
              placeholder={`e.g. "Glitter Gel Set"`}
              value={form.customName}
              onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))}
            />
          </div>

          {/* Price */}
          <div>
            <Label className="text-xs mb-1.5 block">Price</Label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                placeholder="55"
                className="pl-8"
                value={priceDisplay}
                onChange={(e) => setForm((f) => ({ ...f, priceInCents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label className="text-xs mb-1.5 block">Duration</Label>
            <Select
              value={String(form.durationMinutes)}
              onValueChange={(v) => setForm((f) => ({ ...f, durationMinutes: parseInt(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !form.category}>
            {isLoading ? "Saving…" : "Save Service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Profile form state
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [email, setEmail] = useState((user as any)?.email ?? "");
  const [bio, setBio] = useState((user as any)?.bio ?? "");
  const [location, setLocation] = useState((user as any)?.location ?? "");
  const [businessName, setBusinessName] = useState((user as any)?.businessName ?? "");
  const [businessAddress, setBusinessAddress] = useState((user as any)?.businessAddress ?? "");
  const [licenseNumber, setLicenseNumber] = useState((user as any)?.licenseNumber ?? "");
  const [yearsExperience, setYearsExperience] = useState(String((user as any)?.yearsExperience ?? ""));
  const [instagramHandle, setInstagramHandle] = useState((user as any)?.instagramHandle ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>((user as any)?.avatarUrl ?? null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Smart Match global toggle
  const { data: smGlobalEnabled, refetch: refetchSmGlobal } = trpc.smartMatch.getGlobalEnabled.useQuery(undefined, {
    enabled: user?.userType === "nail_tech",
  });
  const setSmGlobal = trpc.smartMatch.setGlobalEnabled.useMutation({
    onSuccess: () => { refetchSmGlobal(); toast.success("Smart Match setting saved"); },
    onError: (e) => toast.error(e.message),
  });

  // Services
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceForm | null>(null);

  const { data: services = [], refetch: refetchServices } = trpc.settings.getServices.useQuery(undefined, {
    enabled: user?.userType === "nail_tech",
  });

  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile saved");
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadAvatar = trpc.settings.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarPreview(data.url);
      utils.auth.me.invalidate();
      toast.success("Photo updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertService = trpc.settings.upsertService.useMutation({
    onSuccess: () => {
      refetchServices();
      setServiceDialogOpen(false);
      setEditingService(null);
      toast.success("Service saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteService = trpc.settings.deleteService.useMutation({
    onSuccess: () => {
      refetchServices();
      toast.success("Service removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadServicePhoto = trpc.settings.uploadServicePhoto.useMutation();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    const b64 = await fileToBase64(file);
    uploadAvatar.mutate({ base64: b64, mimeType: file.type });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate({
      name: name || undefined,
      phone: phone || undefined,
      email: email || undefined,
      bio: bio || undefined,
      location: location || undefined,
      businessName: businessName || undefined,
      businessAddress: businessAddress || undefined,
      licenseNumber: licenseNumber || undefined,
      yearsExperience: yearsExperience ? parseInt(yearsExperience) : undefined,
      instagramHandle: instagramHandle || undefined,
    });
  };

  const handleSaveService = async (form: ServiceForm & { _pendingPhotoBase64?: string }) => {
    const { _pendingPhotoBase64, ...serviceData } = form;
    const result = await upsertService.mutateAsync({
      id: serviceData.id,
      category: serviceData.category,
      customName: serviceData.customName || undefined,
      priceInCents: serviceData.priceInCents,
      durationMinutes: serviceData.durationMinutes,
      photoUrl: serviceData.photoUrl,
      photoKey: serviceData.photoKey,
    });
    // If there's a pending photo and we now have an id, upload it
    if (_pendingPhotoBase64 && result.id) {
      await uploadServicePhoto.mutateAsync({
        serviceId: result.id,
        base64: _pendingPhotoBase64,
        mimeType: "image/jpeg",
      });
      refetchServices();
    }
  };

  const isTech = user?.userType === "nail_tech";
  const initials = user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Edit Profile</h1>
        <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="px-4 py-6 flex flex-col gap-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="w-24 h-24 border-2 border-primary/20">
              <AvatarImage src={avatarPreview ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => avatarRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md"
            >
              <Camera size={14} />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="text-xs text-muted-foreground">Tap to change profile photo</p>
        </div>

        {/* Basic info */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</p>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div>
              <Label className="text-xs mb-1.5 block">Full Name</Label>
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Phone</Label>
              <Input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Email</Label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Bio</Label>
              <Textarea
                placeholder="Tell others a little about yourself…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Location</Label>
              <Input placeholder="City, State" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Tech-specific fields */}
        {isTech && (
          <>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Info</p>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Business / Studio Name</Label>
                  <Input placeholder="e.g. Luxe Nails by Ashley" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Business Address</Label>
                  <Input placeholder="123 Main St, Salt Lake City, UT" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Cosmetology License #</Label>
                  <Input placeholder="License number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Years of Experience</Label>
                  <Input type="number" min={0} max={50} placeholder="e.g. 5" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Instagram Handle</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input className="pl-7" placeholder="yourhandle" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Match global toggle */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Smart Service Match</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Ask clients a few questions before booking to ensure the right service</p>
                  </div>
                </div>
                <button
                  onClick={() => setSmGlobal.mutate({ enabled: !(smGlobalEnabled ?? true) })}
                  disabled={setSmGlobal.isPending}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                    (smGlobalEnabled ?? true) ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    (smGlobalEnabled ?? true) ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </div>

            {/* Services */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services & Pricing</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Clients see these when booking</p>
                </div>
                <button
                  onClick={() => { setEditingService(null); setServiceDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {services.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No services yet</p>
                    <p className="text-xs mt-1">Add your first service to start accepting bookings</p>
                  </div>
                ) : (
                  services.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      service={svc as ServiceForm}
                      onEdit={() => { setEditingService(svc as ServiceForm); setServiceDialogOpen(true); }}
                      onDelete={() => deleteService.mutate({ serviceId: svc.id })}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Service dialog */}
      <ServiceDialog
        open={serviceDialogOpen}
        initial={editingService}
        onSave={handleSaveService}
        onClose={() => { setServiceDialogOpen(false); setEditingService(null); }}
        isLoading={upsertService.isPending || uploadServicePhoto.isPending}
      />
    </div>
  );
}
