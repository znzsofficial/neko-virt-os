import { useEffect, useRef, useState, type RefObject } from "react";

export type LocalMediaItem = { id: string; name: string; url: string; size: number };

export function useLocalMediaPlaylist(kind: "audio" | "video", mediaRef: RefObject<HTMLMediaElement | null>) {
  const [items, setItems] = useState<LocalMediaItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const itemsRef = useRef<LocalMediaItem[]>([]);
  const currentItem = items.find((item) => item.id === currentItemId) ?? null;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  useEffect(() => {
    if (!currentItem || !playing) return;
    mediaRef.current?.play().catch(() => setPlaying(false));
  }, [currentItem, mediaRef, playing]);

  function addFiles(files: FileList | null) {
    const mediaFiles = Array.from(files ?? []).filter((file) => file.type.startsWith(`${kind}/`));
    if (!mediaFiles.length) return;
    const newItems = mediaFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(file),
      size: file.size,
    }));
    setItems((current) => [...current, ...newItems]);
    setCurrentItemId((current) => current ?? newItems[0].id);
  }

  function togglePlayback() {
    if (!currentItem) return;
    if (playing) {
      mediaRef.current?.pause();
      setPlaying(false);
      return;
    }
    setPlaying(true);
  }

  function selectItem(id: string) {
    setCurrentItemId(id);
    setPlaying(true);
  }

  function moveItem(offset: number) {
    if (!items.length) return;
    const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentItemId));
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    setCurrentItemId(items[nextIndex].id);
    setPlaying(true);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      const nextItems = current.filter((item) => item.id !== id);
      if (currentItemId === id) {
        setCurrentItemId(nextItems[0]?.id ?? null);
        setPlaying(false);
      }
      return nextItems;
    });
  }

  return {
    items,
    currentItem,
    currentItemId,
    playing,
    setPlaying,
    addFiles,
    togglePlayback,
    selectItem,
    moveItem,
    removeItem,
  };
}
