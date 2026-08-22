import { useState, useCallback, useEffect, useRef } from 'react';
import { ImageItem } from '../types';

export function useQuickLook(
  images: ImageItem[],
  onIndexChange?: (newIndex: number, newImage: ImageItem | null) => void
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Mirror of currentIndex so navigation handlers can compute the next index
  // without depending on a possibly-stale closure value.
  const currentIndexRef = useRef<number>(0);

  // The viewer is pinned to an IMAGE IDENTITY, not a slot number: when the
  // filtered/sorted list changes mid-view (typing in search, watch-triggered
  // resort), the modal follows the pinned image instead of silently swapping
  // to whatever now occupies currentIndex.
  const pinnedImageIdRef = useRef<string | null>(null);

  // Single application point: updates state, keeps the mirror + pin in sync,
  // and notifies the parent OUTSIDE any setState updater (side effects inside
  // updaters double-fire under StrictMode and are unsafe under concurrent
  // rendering).
  const applyIndex = useCallback((next: number) => {
    currentIndexRef.current = next;
    setCurrentIndex(next);
    pinnedImageIdRef.current = images[next]?.id ?? null;
    onIndexChange?.(next, images[next] || null);
  }, [images, onIndexChange]);

  const openQuickLook = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setIsOpen(true);
      applyIndex(index);
    }
  }, [images, applyIndex]);

  const closeQuickLook = useCallback(() => {
    setIsOpen(false);
  }, []);

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    applyIndex((currentIndexRef.current + 1) % images.length);
  }, [images, applyIndex]);

  const prevImage = useCallback(() => {
    if (images.length === 0) return;
    applyIndex((currentIndexRef.current - 1 + images.length) % images.length);
  }, [images, applyIndex]);

  // Follow the pinned image when the list changes while open (re-sort, filter,
  // deletion of other items); clamp only when it truly vanished.
  useEffect(() => {
    if (!isOpen) return;
    if (images.length === 0) {
      setIsOpen(false);
      return;
    }
    if (currentIndex >= images.length) {
      applyIndex(Math.max(0, images.length - 1));
      return;
    }
    const pinnedId = pinnedImageIdRef.current;
    if (!pinnedId) return;
    const idx = images.findIndex((img) => img.id === pinnedId);
    if (idx >= 0 && idx !== currentIndex) {
      applyIndex(idx);
    }
  }, [images, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isOpen,
    currentIndex,
    currentImage: images[currentIndex] || null,
    openQuickLook,
    closeQuickLook,
    nextImage,
    prevImage,
  };
}
