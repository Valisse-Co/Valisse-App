import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Messages() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();

  const { data: conversations, isLoading } = trpc.messaging.conversations.useQuery(undefined, { enabled: isAuthenticated });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8">
        <MessageCircle size={40} className="text-muted-foreground" />
        <h2 className="text-xl font-display font-light">Messages</h2>
        <p className="text-muted-foreground text-sm text-center">Sign in to view your conversations.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
        <h1 className="text-2xl font-display font-light">Messages</h1>
      </div>

      <div className="pb-24">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-border">
              <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-32" />
                <div className="h-3 bg-muted rounded animate-pulse w-48" />
              </div>
            </div>
          ))
        ) : !conversations || conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle size={24} className="text-muted-foreground" />
            </div>
            {user?.userType === "nail_tech" ? (
              <>
                <p className="text-foreground text-sm font-medium text-center">Communicate with clients to book appointments here.</p>
                <p className="text-muted-foreground text-xs text-center leading-relaxed">
                  Respond to inquiries, confirm availability,<br />and turn messages into bookings.
                </p>
              </>
            ) : (
              <>
                <p className="text-foreground text-sm font-medium text-center">No conversations yet.</p>
                <p className="text-muted-foreground text-xs text-center leading-relaxed">
                  Find a nail tech you love and tap <strong>Message</strong><br />to start a conversation.
                </p>
              </>
            )}
          </div>
        ) : (
          conversations.map(({ conversation }) => {
            const isClient = user?.userType === "client";
            const otherId = isClient ? conversation.techId : conversation.clientId;
            return (
              <ConversationItem
                key={conversation.id}
                conversationId={conversation.id}
                otherId={otherId}
                lastMessageAt={new Date(conversation.lastMessageAt as any)}
                onClick={() => navigate(`/chat/${conversation.id}`)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conversationId, otherId, lastMessageAt, onClick }: {
  conversationId: number;
  otherId: number;
  lastMessageAt: Date;
  onClick: () => void;
}) {
  const { data: profileData } = trpc.users.getProfile.useQuery({ userId: otherId });
  const other = profileData?.user;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors text-left"
    >
      <Avatar className="w-12 h-12 border border-border">
        <AvatarImage src={other?.avatarUrl ?? undefined} />
        <AvatarFallback className="bg-accent text-primary font-semibold">
          {(other?.name ?? "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-foreground truncate">
            {other?.businessName || other?.name || "Loading..."}
          </p>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {other?.userType === "nail_tech" ? "Nail Tech" : "Client"} · Tap to open chat
        </p>
      </div>
    </motion.button>
  );
}
