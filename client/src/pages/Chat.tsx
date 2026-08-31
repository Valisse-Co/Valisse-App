import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Send, Calendar, CheckCircle, ImagePlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Props { conversationId: number }

export default function Chat({ conversationId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: messages, refetch } = trpc.messaging.messages.useQuery(
    { conversationId },
    { refetchInterval: 3_000 }
  );
  const { data: conversations } = trpc.messaging.conversations.useQuery();
  const conversation = conversations?.find(c => c.conversation.id === conversationId)?.conversation;
  const isClientMode = user?.userType === "client" || user?.activeMode === "client";
  const otherId = conversation ? (isClientMode ? conversation.techId : conversation.clientId) : null;
  const { data: otherProfile } = trpc.users.getProfile.useQuery(
    { userId: otherId! },
    { enabled: !!otherId }
  );
  const other = otherProfile?.user;

  const sendMessage = trpc.messaging.send.useMutation({
    onSuccess: () => {
      setText("");
      refetch();
      utils.messaging.conversations.invalidate();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (error) => toast.error(error.message || "Failed to send message"),
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
    if (!other || !isClientMode) return;
    sendMessage.mutate({
      conversationId,
      content: "Hi! I'd love to book an appointment with you.",
      type: "booking_request",
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
    <div className="flex flex-col h-screen bg-background page-enter">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border bg-background/95 backdrop-blur-sm z-40">
        <button onClick={() => navigate("/messages")} aria-label="Back to messages" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        {other && (
          <>
            <Avatar className="w-10 h-10 border border-border">
              <AvatarImage src={other.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent text-primary font-semibold text-sm">{(other.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{other.businessName || other.name}</p>
              <p className="text-xs text-muted-foreground">{other.userType === "nail_tech" ? "Nail Tech" : "Client"}</p>
            </div>
            {isClientMode && (
              <button onClick={() => navigate(`/book/${other.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium">
                <Calendar size={13} /> Book
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center"><span className="text-2xl">💬</span></div>
            <p className="text-muted-foreground text-sm">Start the conversation!<br />Ask about availability or services.</p>
            {isClientMode && (
              <button onClick={handleSendBookingRequest} className="flex items-center gap-2 btn-valisse-outline px-4 py-2 text-sm mt-2">
                <Calendar size={14} /> Send Booking Request
              </button>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const isBookingCard = msg.type === "booking_request" || msg.type === "booking_card";
            const formattedTime = new Date(msg.createdAt as any).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                {isBookingCard ? (
                  <div className={cn("max-w-[80%] rounded-2xl border overflow-hidden", isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
                    <div className="bg-primary/10 px-4 py-2.5 flex items-center gap-2"><Calendar size={15} className="text-primary" /><span className="text-sm font-semibold text-primary">Booking Request</span></div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-foreground">{msg.content}</p>
                      {!isMe && isClientMode && otherId && (
                        <button onClick={() => navigate(`/book/${otherId}`)} className="w-full btn-valisse py-2 text-xs mt-3"><CheckCircle size={13} className="inline mr-1" />View Availability</button>
                      )}
                    </div>
                    <p className="px-4 pb-2 text-[10px] text-muted-foreground">{formattedTime}{isMe && msg.isRead ? " · Seen" : ""}</p>
                  </div>
                ) : (
                  <div className={cn("max-w-[75%] rounded-2xl px-3 py-2.5 text-sm", isMe ? "bg-primary text-white rounded-br-sm" : "bg-card border border-border text-foreground rounded-bl-sm")}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="Shared in conversation" className={cn("rounded-xl max-h-72 w-full object-cover", msg.content && "mb-2")} />}
                    {msg.content && <p className="leading-relaxed px-1">{msg.content}</p>}
                    <p className={cn("text-[10px] mt-1 px-1", isMe ? "text-white/60" : "text-muted-foreground")}>{formattedTime}{isMe && msg.isRead ? " · Seen" : ""}</p>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-24 pt-3 border-t border-border bg-background">
        {isClientMode && (
          <div className="flex gap-2 mb-2">
            <button onClick={handleSendBookingRequest} disabled={sendMessage.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-border text-foreground text-xs font-medium hover:border-primary/40 transition-colors disabled:opacity-50"><Calendar size={12} className="text-primary" />Request Booking</button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 py-2">
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChoose} />
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage || sendMessage.isPending} aria-label="Send a photo" className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50"><ImagePlus size={18} /></button>
          <input type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={isUploadingImage ? "Uploading photo…" : "Message..."} className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          <button onClick={handleSend} disabled={!text.trim() || sendMessage.isPending || isUploadingImage} aria-label="Send message" className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", text.trim() ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground")}><Send size={15} /></button>
        </div>
      </div>
    </div>
  );
}
