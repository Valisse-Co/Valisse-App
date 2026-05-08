import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Send, Calendar, CheckCircle, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Props { conversationId: number }

export default function Chat({ conversationId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = trpc.messaging.messages.useQuery(
    { conversationId },
    { refetchInterval: 3000 }
  );

  const { data: conversations } = trpc.messaging.conversations.useQuery();
  const conversation = conversations?.find(c => c.conversation.id === conversationId)?.conversation;
  const isClient = user?.userType === "client";
  const otherId = conversation ? (isClient ? conversation.techId : conversation.clientId) : null;
  const { data: otherProfile } = trpc.users.getProfile.useQuery(
    { userId: otherId! },
    { enabled: !!otherId }
  );
  const other = otherProfile?.user;

  const sendMessage = trpc.messaging.send.useMutation({
    onSuccess: () => {
      setText("");
      refetch();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: () => toast.error("Failed to send message"),
  });

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage.mutate({ conversationId, content: text.trim(), type: "text" });
  };

  const handleSendBookingRequest = () => {
    if (!other) return;
    sendMessage.mutate({
      conversationId,
      content: `Hi! I'd love to book an appointment with you.`,
      type: "booking_request",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border bg-background/95 backdrop-blur-sm z-40">
        <button onClick={() => navigate("/messages")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        {other && (
          <>
            <Avatar className="w-10 h-10 border border-border">
              <AvatarImage src={other.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-accent text-primary font-semibold text-sm">
                {(other.name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{other.businessName || other.name}</p>
              <p className="text-xs text-muted-foreground">{other.userType === "nail_tech" ? "Nail Tech" : "Client"}</p>
            </div>
            {isClient && (
              <button
                onClick={() => navigate(`/book/${other.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium"
              >
                <Calendar size={13} />
                Book
              </button>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-muted-foreground text-sm">Start the conversation!<br />Ask about availability or services.</p>
            {isClient && (
              <button
                onClick={handleSendBookingRequest}
                className="flex items-center gap-2 btn-valisse-outline px-4 py-2 text-sm mt-2"
              >
                <Calendar size={14} />
                Send Booking Request
              </button>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const isBookingCard = msg.type === "booking_request" || msg.type === "booking_card";

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", isMe ? "justify-end" : "justify-start")}
              >
                {isBookingCard ? (
                  /* Booking request card */
                  <div className={cn(
                    "max-w-[80%] rounded-2xl border overflow-hidden",
                    isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                  )}>
                    <div className="bg-primary/10 px-4 py-2.5 flex items-center gap-2">
                      <Calendar size={15} className="text-primary" />
                      <span className="text-sm font-semibold text-primary">Booking Request</span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-foreground">{msg.content}</p>
                      {!isMe && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigate(`/book/${msg.senderId}`)}
                            className="flex-1 btn-valisse py-2 text-xs"
                          >
                            <CheckCircle size={13} className="inline mr-1" />
                            View Availability
                          </button>
                        </div>
                      )}
                      {isMe && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <CheckCircle size={11} /> Sent
                        </p>
                      )}
                    </div>
                    <div className="px-4 pb-2">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt as any).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Regular message bubble */
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    isMe
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  )}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={cn("text-[10px] mt-1", isMe ? "text-white/60" : "text-muted-foreground")}>
                      {new Date(msg.createdAt as any).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-24 pt-3 border-t border-border bg-background">
        {isClient && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleSendBookingRequest}
              disabled={sendMessage.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-border text-foreground text-xs font-medium hover:border-primary/40 transition-colors"
            >
              <Calendar size={12} className="text-primary" />
              Request Booking
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Message..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              text.trim() ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground"
            )}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
