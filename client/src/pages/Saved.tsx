import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Folder, X, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function Saved() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeCollection, setActiveCollection] = useState<number | null>(null);

  const { data: collections, refetch: refetchCollections } = trpc.collections.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: savedPosts } = trpc.collections.savedPosts.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const createCollection = trpc.collections.create.useMutation({
    onSuccess: () => {
      setNewName("");
      setShowNewCollection(false);
      utils.collections.list.invalidate();
      toast.success("Collection created");
    },
  });

  const deleteCollection = trpc.collections.delete.useMutation({
    onSuccess: () => {
      utils.collections.list.invalidate();
      toast.success("Collection deleted");
    },
  });

  const toggleSave = trpc.posts.toggleSave.useMutation({
    onSuccess: () => utils.collections.savedPosts.invalidate(),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8">
        <Bookmark size={40} className="text-muted-foreground" />
        <h2 className="text-xl font-display font-light">Your Saved Posts</h2>
        <p className="text-muted-foreground text-sm text-center">Sign in to save and organize your favorite nail looks.</p>
      </div>
    );
  }

  const filteredPosts = activeCollection
    ? savedPosts?.filter(s => s.savedPost.collectionId === activeCollection) ?? []
    : savedPosts ?? [];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-light">Saved</h1>
          <button
            onClick={() => setShowNewCollection(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium"
          >
            <Plus size={14} /> New Board
          </button>
        </div>

        {/* Collections chips */}
        {collections && collections.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3 -mx-4 px-4">
            <button
              onClick={() => setActiveCollection(null)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all",
                activeCollection === null ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
              )}
            >
              <Bookmark size={12} /> All
            </button>
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(activeCollection === col.id ? null : col.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all",
                  activeCollection === col.id ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                )}
              >
                <Folder size={12} /> {col.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="p-3 pb-24">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bookmark size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              {activeCollection ? "No posts in this collection" : "Save nail looks you love to find them later"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPosts.map(({ savedPost, post, tech }) => {
              if (!post) return null;
              return (
                <motion.div
                  key={savedPost.id}
                  whileTap={{ scale: 0.97 }}
                  className="relative rounded-2xl overflow-hidden cursor-pointer bg-muted"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  {post.imageUrls?.[0] ? (
                    <img src={post.imageUrls[0]} alt="" className="w-full object-cover" style={{ aspectRatio: "3/4" }} />
                  ) : (
                    <div className="w-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1]" style={{ aspectRatio: "3/4" }}>
                      <div className="w-full h-full flex items-center justify-center"><span className="text-4xl">💅</span></div>
                    </div>
                  )}
                  <div className="absolute inset-0 img-overlay" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-white text-xs font-medium truncate">{tech?.businessName || tech?.name || "Nail Tech"}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSave.mutate({ postId: post.id }); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Collection Dialog */}
      <Dialog open={showNewCollection} onOpenChange={setShowNewCollection}>
        <DialogContent className="rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-xl">New Collection</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <Input
              placeholder="e.g. Wedding Inspo, Summer Nails..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="rounded-xl h-12"
              onKeyDown={e => e.key === "Enter" && newName.trim() && createCollection.mutate({ name: newName.trim() })}
            />
            <button
              onClick={() => newName.trim() && createCollection.mutate({ name: newName.trim() })}
              disabled={!newName.trim() || createCollection.isPending}
              className="btn-valisse py-3"
            >
              {createCollection.isPending ? "Creating..." : "Create Collection"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
