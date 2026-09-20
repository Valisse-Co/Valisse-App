import { useEffect, useRef, useState } from "react";
import { ImagePlus, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export function ReviewDialog({
  open,
  onOpenChange,
  bookingId,
  techId,
  techName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  techId: number;
  techName: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = trpc.reviews.uploadPhoto.useMutation();
  const createReview = trpc.reviews.create.useMutation();
  const submitting = uploadPhoto.isPending || createReview.isPending;

  useEffect(() => {
    if (!open) {
      setRating(0);
      setText("");
      setFiles([]);
    }
  }, [open]);

  const addFiles = (incoming: File[]) => {
    const accepted = incoming.filter((file) => {
      if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
        toast.error(`${file.name} is not a supported image.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5 MB.`);
        return false;
      }
      return true;
    });
    setFiles((current) => [...current, ...accepted].slice(0, 5));
  };

  const submit = async () => {
    if (!rating) {
      toast.error("Choose a star rating.");
      return;
    }
    try {
      const photoUrls: string[] = [];
      for (const file of files) {
        const result = await uploadPhoto.mutateAsync({
          base64: await fileToBase64(file),
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        });
        photoUrls.push(result.url);
      }
      await createReview.mutateAsync({ bookingId, techId, rating, text: text.trim() || undefined, photoUrls });
      toast.success("Review published");
      onOpenChange(false);
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish your review.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Review {techName}</DialogTitle></DialogHeader>
        <div>
          <p className="text-sm text-muted-foreground mb-2">How was your completed appointment?</p>
          <div className="flex gap-1" aria-label="Star rating">
            {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
              <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? "" : "s"}`}>
                <Star size={28} className={cn(value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35")} />
              </button>
            ))}
          </div>
        </div>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={4} placeholder="Share details that will help future clients…" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Photos <span className="text-muted-foreground font-normal">(optional)</span></p>
            <span className="text-xs text-muted-foreground">{files.length}/5</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={URL.createObjectURL(file)} alt="Review preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center"><X size={11} /></button>
              </div>
            ))}
            {files.length < 5 && (
              <button type="button" onClick={() => inputRef.current?.click()} className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground"><ImagePlus size={18} /></button>
            )}
          </div>
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        </div>
        <Button onClick={submit} disabled={!rating || submitting}>{submitting ? "Publishing…" : "Publish review"}</Button>
      </DialogContent>
    </Dialog>
  );
}

export default ReviewDialog;
