import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Folder, X, Bookmark, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SaveAlbumSheet } from "@/components/SaveAlbumSheet";

// ─── Album Grid Tile ─────────────────────────────────────────────────────────
function AlbumTile({ name, count, coverUrl, onClick }: { name: string; count: number; coverUrl: string | null; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden bg-muted aspect-square w-full text-left shadow-sm"
    >
      {coverUrl ? (
        <img src={coverUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#D0EDE6] to-[#E6F5F1] flex items-center justify-center">
          <Folder size={28} className="text-primary/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white text-xs font-semibold truncate">{name}</p>
        <p className="text-white/70 text-[10px]">{count} {count === 1 ? "post" : "posts"}</p>
      </div>
    </motion.button>
  );
}

// ─── Album Detail View ────────────────────────────────────────────────────────
function AlbumDetail({
  collectionId,
  albumName,
  onBack,
}: {
  collectionId: number | null;
  albumName: string;
  onBack: () => void;
}) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [albumSheetPostId, setAlbumSheetPostId] = useState<number | null>(null);

  const { data: posts, isLoading } = trpc.collections.postsInAlbum.useQuery(
    { collectionId },
    { enabled: isAuthenticated }
  );

  const unsaveMutation = trpc.posts.unsave.useMutation({
    onSuccess: () => {
      utils.collections.postsInAlbum.invalidate();
      utils.collections.listWithMeta.invalidate();
      utils.collections.savedPostIds.invalidate();
      toast.success("Removed from saved");
    },
  });

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-display font-light flex-1 truncate">{albumName}</h1>
          <span className="text-xs text-muted-foreground">{posts?.length ?? 0} posts</span>
        </div>
      </div>

      <div className="p-3 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {posts.map(({ savedPost, post, tech }: any) => {
              if (!post) return null;
              return (
                <motion.div
                  key={savedPost.id}
                  whileTap={{ scale: 0.97 }}
                  className="relative rounded-2xl overflow-hidden cursor-pointer bg-muted"
                  onClick={() => navigate(`/post/${post.id}?from=/saved`)}
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
                  {/* Bookmark icon — opens album sheet */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAlbumSheetPostId(post.id); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary/90 backdrop-blur-sm text-white flex items-center justify-center"
                  >
                    <Bookmark size={13} fill="currentColor" />
                  </button>
                  {/* Remove button */}
                  {collectionId === null && (
                    <button
                      onClick={(e) => { e.stopPropagation(); unsaveMutation.mutate({ postId: post.id }); }}
                      className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center"
                    >
                      <X size={13} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bookmark size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              {collectionId ? "No posts in this album yet" : "Save nail looks you love to find them later"}
            </p>
          </div>
        )}
      </div>

      {/* Album sheet for re-organizing */}
      {albumSheetPostId !== null && (
        <SaveAlbumSheet
          postId={albumSheetPostId}
          open={albumSheetPostId !== null}
          onOpenChange={(open) => { if (!open) setAlbumSheetPostId(null); }}
          onSaveStateChange={() => {
            utils.collections.postsInAlbum.invalidate();
            utils.collections.listWithMeta.invalidate();
            utils.collections.savedPostIds.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Main Saved Page ──────────────────────────────────────────────────────────
export default function Saved() {
  const { isAuthenticated } = useAuth();
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeAlbum, setActiveAlbum] = useState<{ id: number | null; name: string } | null>(null);
  const utils = trpc.useUtils();

  const { data: meta, isLoading } = trpc.collections.listWithMeta.useQuery(undefined, { enabled: isAuthenticated });

  const createCollection = trpc.collections.create.useMutation({
    onSuccess: () => {
      setNewName("");
      setShowNewCollection(false);
      utils.collections.listWithMeta.invalidate();
      utils.collections.list.invalidate();
      toast.success("Album created");
    },
  });

  const deleteCollection = trpc.collections.delete.useMutation({
    onSuccess: () => {
      utils.collections.listWithMeta.invalidate();
      utils.collections.list.invalidate();
      toast.success("Album deleted");
    },
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

  // Show album detail view
  if (activeAlbum !== null) {
    return (
      <AlbumDetail
        collectionId={activeAlbum.id}
        albumName={activeAlbum.name}
        onBack={() => setActiveAlbum(null)}
      />
    );
  }

  const allSaved = (meta && 'allSaved' in meta) ? meta.allSaved : { count: 0, coverUrl: null };
  const albums = (meta && 'albums' in meta) ? meta.albums : [];

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
            <Plus size={14} /> New Album
          </button>
        </div>
      </div>

      {/* Album grid */}
      <div className="p-4 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* All Saved — always first */}
            <AlbumTile
              name="All Saved"
              count={allSaved.count}
              coverUrl={allSaved.coverUrl}
              onClick={() => setActiveAlbum({ id: null, name: "All Saved" })}
            />

            {/* Custom albums */}
            {albums.map(album => (
              <div key={album.id} className="relative group">
                <AlbumTile
                  name={album.name}
                  count={album.postCount}
                  coverUrl={album.coverUrl}
                  onClick={() => setActiveAlbum({ id: album.id, name: album.name })}
                />
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete album "${album.name}"?`)) {
                      deleteCollection.mutate({ id: album.id });
                    }
                  }}
                  className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Empty state if no albums yet */}
            {albums.length === 0 && allSaved.count === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Bookmark size={24} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm text-center">Save nail looks you love to find them later</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Album Dialog */}
      <Dialog open={showNewCollection} onOpenChange={setShowNewCollection}>
        <DialogContent className="rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-xl">New Album</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <Input
              placeholder="e.g. Wedding Inspo, Summer Nails..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="rounded-xl h-12"
              onKeyDown={e => e.key === "Enter" && newName.trim() && createCollection.mutate({ name: newName.trim() })}
              autoFocus
            />
            <button
              onClick={() => newName.trim() && createCollection.mutate({ name: newName.trim() })}
              disabled={!newName.trim() || createCollection.isPending}
              className="btn-valisse py-3"
            >
              {createCollection.isPending ? "Creating..." : "Create Album"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
