import { useState } from "react";
import { useLocation } from "wouter";
import { Search, MessageCircle, MapPin, ShieldCheck, UserRound, Scissors } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SearchPeople() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const { data: results = [], isFetching } = trpc.users.search.useQuery(
    { query: trimmed },
    { enabled: trimmed.length >= 2 },
  );
  const startConversation = trpc.messaging.getOrCreateConversation.useMutation({
    onSuccess: (conversation) => navigate(`/chat/${conversation.id}`),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen bg-background px-4 py-5 page-enter">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Valisse network</p>
        <h1 className="font-display text-3xl font-light text-foreground mt-1">Find people</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Search nail techs in either mode. Client profiles appear only when you have an appointment relationship.
        </p>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or business…"
          className="h-12 rounded-2xl pl-10 bg-card"
        />
      </div>

      <div className="mt-5 space-y-3 pb-24">
        {trimmed.length < 2 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Search size={24} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Enter at least two characters to search.</p>
          </div>
        ) : isFetching ? (
          Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 rounded-2xl bg-muted animate-pulse" />)
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <UserRound size={26} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No permitted profiles found</p>
            <p className="text-xs text-muted-foreground mt-1">Try a full name or business name.</p>
          </div>
        ) : results.map((result) => {
          const isTech = result.resultType === "nail_tech";
          const displayName = result.businessName || result.name || (isTech ? "Nail tech" : "Client");
          return (
            <article key={result.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border border-border">
                  <AvatarImage src={result.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isTech ? <Scissors size={13} className="text-primary" /> : <ShieldCheck size={13} className="text-primary" />}
                    <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{isTech ? "Nail Tech" : "Appointment client"}</p>
                  {result.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin size={11} />{result.location}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {isTech && (
                  <button onClick={() => navigate(`/tech/${result.id}?from=/search`)} className="flex-1 btn-valisse-outline py-2 text-xs">View business profile</button>
                )}
                <button
                  onClick={() => startConversation.mutate({ targetUserId: result.id })}
                  disabled={startConversation.isPending}
                  className="flex-1 btn-valisse py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <MessageCircle size={13} /> Message
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
