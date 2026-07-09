import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Folder, Check, X, Bookmark } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SaveAlbumSheetProps {
  postId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when save state changes so parent can update icon */
  onSaveStateChange?: (isSaved: boolean) => void;
}

export function SaveAlbumSheet({ postId, open, onOpenChange, onSaveStateChange }: SaveAlbumSheetProps) {
  const utils = trpc.useUtils();

  // Fetch current save state + album memberships
  const { data: saveState, isLoading: loadingSaveState } = trpc.posts.saveState.useQuery(
    { postId },
    { enabled: open }
  );

  // Fetch custom albums
  const { data: collectionsData } = trpc.collections.list.useQuery(undefined, { enabled: open });
  const albums = collectionsData ?? [];

  // Local checked state (album IDs)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [isSaved, setIsSaved] = useState(false);

  // Sync from server when sheet opens
  useEffect(() => {
    if (saveState) {
      setIsSaved(saveState.isSaved);
      setCheckedIds(new Set(saveState.albumIds));
    }
  }, [saveState]);

  // New album inline creation
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  const createAlbum = trpc.collections.create.useMutation({
    onSuccess: (data) => {
      utils.collections.list.invalidate();
      // Auto-check the new album
      setCheckedIds(prev => new Set([...Array.from(prev), data.id]));
      setNewAlbumName("");
      setShowNewAlbum(false);
      toast.success("Album created");
    },
  });

  const saveMutation = trpc.posts.save.useMutation({
    onSuccess: () => {
      setIsSaved(true);
      onSaveStateChange?.(true);
    },
  });

  const unsaveMutation = trpc.posts.unsave.useMutation({
    onSuccess: () => {
      setIsSaved(false);
      setCheckedIds(new Set());
      onSaveStateChange?.(false);
      utils.collections.savedPostIds.invalidate();
      utils.collections.savedPosts.invalidate();
      onOpenChange(false);
      toast.success("Removed from saved");
    },
  });

  const setMembershipsMutation = trpc.posts.setAlbumMemberships.useMutation({
    onSuccess: () => {
      utils.collections.postsInAlbum.invalidate();
      utils.collections.listWithMeta.invalidate();
    },
  });

  const handleToggleAlbum = (albumId: number) => {
    setCheckedIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(albumId)) next.delete(albumId);
      else next.add(albumId);
      return next;
    });
  };

  const handleDone = async () => {
    // Ensure post is saved first
    if (!isSaved) {
      await saveMutation.mutateAsync({ postId });
    }
    // Update album memberships
    await setMembershipsMutation.mutateAsync({ postId, collectionIds: Array.from(checkedIds) });
    utils.collections.savedPostIds.invalidate();
    utils.collections.savedPosts.invalidate();
    onSaveStateChange?.(true);
    onOpenChange(false);
    toast.success(isSaved ? "Albums updated" : "Saved!");
  };

  const handleRemove = () => {
    unsaveMutation.mutate({ postId });
  };

  const handleCreateAlbum = () => {
    if (!newAlbumName.trim()) return;
    createAlbum.mutate({ name: newAlbumName.trim() });
  };

  const isPending = saveMutation.isPending || setMembershipsMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-safe max-h-[80vh] overflow-y-auto">
        <SheetHeader className="px-5 pb-3 border-b border-border">
          <SheetTitle className="font-display font-light text-xl flex items-center gap-2">
            <Bookmark size={18} className={cn(isSaved ? "text-primary fill-primary" : "text-muted-foreground")} />
            {isSaved ? "Saved" : "Save to..."}
          </SheetTitle>
          {isSaved && (
            <p className="text-xs text-muted-foreground mt-0.5">In All Saved · select albums below</p>
          )}
        </SheetHeader>

        {loadingSaveState ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="px-5 pt-4 pb-2 flex flex-col gap-2">
            {albums.length === 0 && !showNewAlbum && (
              <p className="text-sm text-muted-foreground py-2">No albums yet — create one below.</p>
            )}

            {albums.map(album => (
              <button
                key={album.id}
                onClick={() => handleToggleAlbum(album.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all text-left",
                  checkedIds.has(album.id)
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                  checkedIds.has(album.id) ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}>
                  {checkedIds.has(album.id) && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <Folder size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{album.name}</span>
              </button>
            ))}

            {/* New album inline */}
            {showNewAlbum ? (
              <div className="flex gap-2 mt-1">
                <Input
                  autoFocus
                  placeholder="Album name..."
                  value={newAlbumName}
                  onChange={e => setNewAlbumName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateAlbum(); if (e.key === "Escape") setShowNewAlbum(false); }}
                  className="rounded-xl h-11 flex-1"
                />
                <button
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumName.trim() || createAlbum.isPending}
                  className="px-4 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}
                  className="w-11 h-11 rounded-xl border border-border flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewAlbum(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all text-sm w-full"
              >
                <Plus size={16} />
                New Album
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 pt-3 pb-6 flex flex-col gap-2 border-t border-border mt-2">
          <button
            onClick={handleDone}
            disabled={isPending}
            className="btn-valisse py-3 w-full"
          >
            {isPending ? "Saving..." : isSaved ? "Done" : "Save"}
          </button>
          {isSaved && (
            <button
              onClick={handleRemove}
              disabled={unsaveMutation.isPending}
              className="py-3 w-full rounded-2xl border border-border text-destructive text-sm font-medium hover:bg-destructive/5 transition-all"
            >
              {unsaveMutation.isPending ? "Removing..." : "Remove from Saved"}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
