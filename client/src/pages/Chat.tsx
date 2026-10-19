import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Send, Calendar, CheckCircle, ImagePlus, Clock3, Share2, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Props { conversationId: number }

type AvailabilityOffer = {
  note: string | null;
  timeZone: string;
  fallbackHref: string;
  windows: Array<{
    id: number;
    localDate: string;
    startTime: string;
    endTime: string;
    audience: "open" | "returning_only";
    href: string | null;
  }>;
};

function formatOfferDate(localDate: string) {
  return new Date(`${localDate}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatOfferTime(value: string) {
  return new Date(`1970-01-01T${value}:00Z`).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readableTimeZone(timeZone: string) {
  return timeZone.replace(/_/g, " ").replace("America/", "");
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `availability-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function AvailabilityOfferCard({ offer, isClient, isMe, formattedTime, isRead, onNavigate }: {
  offer: AvailabilityOffer;
  isClient: boolean;
  isMe: boolean;
  formattedTime: string;
  isRead: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className={cn("max-w-[88%] overflow-hidden rounded-2xl border", isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
      <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2.5">
        <Clock3 size={15} className="text-emerald-700" />
        <span className="text-sm font-semibold text-emerald-900">Availability shared</span>
      </div>
      <div className="space-y-3 px-3 py-3">
        {offer.note && <p className="px-1 text-sm leading-relaxed text-foreground">{offer.note}</p>}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Upcoming openings in {readableTimeZone(offer.timeZone)} time. Times update live and are not held until booked.</p>
        <div className="space-y-2">
          {offer.windows.map((window) => (
            <button
              key={window.id}
              type="button"
              disabled={!isClient || !window.href}
              onClick={() => window.href && onNavigate(window.href)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                isClient && window.href ? "border-border hover:border-primary/50 hover:bg-primary/5" : "border-border/70 bg-muted/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{formatOfferDate(window.localDate)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatOfferTime(window.startTime)} – {formatOfferTime(window.endTime)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold", window.audience === "returning_only" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800")}>
                  {window.audience === "returning_only" ? "Returning clients" : "Anyone"}
                </span>
              </div>
              {isClient && window.href && <p className="mt-2 text-xs font-semibold text-primary">Book this time</p>}
            </button>
          ))}
        </div>
        {isClient && <button type="button" onClick={() => onNavigate(offer.fallbackHref)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"><CalendarDays size={14} /> View all availability</button>}
      </div>
      <p className="px-4 pb-2 text-[10px] text-muted-foreground">{formattedTime}{isMe && isRead ? " · Seen" : ""}</p>
    </div>
  );
}

export default function Chat({ conversationId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: messages, refetch } = trpc.messaging.messages.useQuery(
    { conversationId },
    { refetchInterval: 3_000 },
  );
  const { data: conversations } = trpc.messaging.conversations.useQuery();
  const conversationSummary = conversations?.find((conversation) => conversation.conversation.id === conversationId);
  const conversation = conversationSummary?.conversation;
  const other = conversationSummary?.otherUser;
  const otherId = other?.id ?? null;
  const isClientMode = (user?.activeMode ?? user?.userType) === "client";
  const canBookPartner = isClientMode && conversationSummary?.otherRole === "nail_tech";
  const canShareAvailability = Boolean(
    user
    && conversation
    && conversation.techId === user.id
    && conversation.techRole === "nail_tech"
    && conversation.clientRole === "client"
    && conversationSummary?.otherRole === "client",
  );

  const refreshConversation = () => {
    refetch();
    utils.messaging.conversations.invalidate();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = trpc.messaging.send.useMutation({
    onSuccess: () => {
      setText("");
      refreshConversation();
    },
    onError: (error) => toast.error(error.message || "Failed to send message"),
  });
  const sendAvailabilityOffer = trpc.messaging.sendAvailabilityOffer.useMutation({
    onSuccess: () => {
      setAvailabilityNote("");
      setAvailabilityDialogOpen(false);
      refreshConversation();
      toast.success("Availability shared with your client.");
    },
    onError: (error) => toast.error(error.message || "Could not share availability"),
  });
  const uploadImage = trpc.messaging.uploadImage.useMutation();

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ conversationId, content: text.trim(), type: "text" });
  };

  const handleSendBookingRequest = () => {
    if (!other || !canBookPartner) return;
    sendMessage.mutate({
      conversationId,
      content: "Hi! I'd love to book an appointment with you.",
      type: "booking_request",
    });
  };

  const handleShareAvailability = () => {
    if (!canShareAvailability || sendAvailabilityOffer.isPending) return;
    sendAvailabilityOffer.mutate({
      conversationId,
      note: availabilityNote.trim() || undefined,
      idempotencyKey: createIdempotencyKey(),
    });
  };

  const handleImageChoose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images must be 5 MB or smaller.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.readAsDataURL(file);
      });
      const { url } = await uploadImage.mutateAsync({
        base64,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
      });
      await sendMessage.mutateAsync({
        conversationId,
        imageUrl: url,
        content: text.trim() || undefined,
        type: "image",
      });
    } catch {
      toast.error("Could not send that photo. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background page-enter">
      <div className="z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-3 pt-12 backdrop-blur-sm">
        <button onClick={() => navigate("/messages")} aria-label="Back to messages" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft size={20} />
        </button>
        {other && (
          <>
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={other.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent text-sm font-semibold text-primary">{(other.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{other.businessName || other.name}</p>
              <p className="text-xs text-muted-foreground">{conversationSummary?.otherRole === "nail_tech" ? "Nail Tech" : "Client"}</p>
            </div>
            {canBookPartner && (
              <button onClick={() => navigate(`/book/${other.id}`)} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white">
                <Calendar size={13} /> Book
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages || messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent"><span className="text-2xl">💬</span></div>
            <p className="text-sm text-muted-foreground">Start the conversation!<br />Ask about availability or services.</p>
            {canBookPartner && (
              <button onClick={handleSendBookingRequest} className="mt-2 flex items-center gap-2 px-4 py-2 text-sm btn-valisse-outline">
                <Calendar size={14} /> Send Booking Request
              </button>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId === user?.id;
            const isBookingCard = message.type === "booking_request" || message.type === "booking_card";
            const isAvailabilityOffer = message.type === "availability_offer" && message.availabilityOffer;
            const formattedTime = new Date(message.createdAt as any).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

            return (
              <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                {isAvailabilityOffer ? (
                  <AvailabilityOfferCard offer={message.availabilityOffer as AvailabilityOffer} isClient={isClientMode} isMe={isMe} formattedTime={formattedTime} isRead={message.isRead} onNavigate={navigate} />
                ) : isBookingCard ? (
                  <div className={cn("max-w-[80%] overflow-hidden rounded-2xl border", isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
                    <div className="flex items-center gap-2 bg-primary/10 px-4 py-2.5"><Calendar size={15} className="text-primary" /><span className="text-sm font-semibold text-primary">Booking Request</span></div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-foreground">{message.content}</p>
                      {!isMe && canBookPartner && otherId && (
                        <button onClick={() => navigate(`/book/${otherId}`)} className="mt-3 w-full py-2 text-xs btn-valisse"><CheckCircle size={13} className="mr-1 inline" />View Availability</button>
                      )}
                    </div>
                    <p className="px-4 pb-2 text-[10px] text-muted-foreground">{formattedTime}{isMe && message.isRead ? " · Seen" : ""}</p>
                  </div>
                ) : (
                  <div className={cn("max-w-[75%] rounded-2xl px-3 py-2.5 text-sm", isMe ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-border bg-card text-foreground")}>
                    {message.imageUrl && <img src={message.imageUrl} alt="Shared in conversation" className={cn("max-h-72 w-full rounded-xl object-cover", message.content && "mb-2")} />}
                    {message.content && <p className="px-1 leading-relaxed">{message.content}</p>}
                    <p className={cn("mt-1 px-1 text-[10px]", isMe ? "text-white/60" : "text-muted-foreground")}>{formattedTime}{isMe && message.isRead ? " · Seen" : ""}</p>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background px-4 pb-24 pt-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {canBookPartner && (
            <button onClick={handleSendBookingRequest} disabled={sendMessage.isPending} className="flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"><Calendar size={12} className="text-primary" />Request Booking</button>
          )}
          {canShareAvailability && (
            <button onClick={() => setAvailabilityDialogOpen(true)} disabled={sendAvailabilityOffer.isPending} className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"><Share2 size={12} />Share availability</button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChoose} />
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage || sendMessage.isPending} aria-label="Send a photo" className="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10 disabled:opacity-50"><ImagePlus size={18} /></button>
          <input type="text" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && handleSend()} placeholder={isUploadingImage ? "Uploading photo…" : "Message..."} className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <button onClick={handleSend} disabled={!text.trim() || sendMessage.isPending || isUploadingImage} aria-label="Send message" className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all", text.trim() ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground")}><Send size={15} /></button>
        </div>
      </div>

      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="mx-4 max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Share your next openings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">Valisse will send this client the next three bookable time blocks from your real schedule, with a link to your live booking page. Times are not reserved and are checked again when they tap.</p>
            <div>
              <label className="text-xs font-semibold text-foreground" htmlFor="availability-note">Optional note</label>
              <Textarea id="availability-note" maxLength={1000} value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} placeholder="I had a few openings come up this week—would love to see you." className="mt-1 min-h-24" />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{availabilityNote.length}/1000</p>
            </div>
            <button type="button" onClick={handleShareAvailability} disabled={sendAvailabilityOffer.isPending} className="flex w-full items-center justify-center gap-2 py-2.5 text-sm btn-valisse">
              <Share2 size={15} />{sendAvailabilityOffer.isPending ? "Finding openings…" : "Send next 3 openings"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
