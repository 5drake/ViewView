import { useState, useCallback, useEffect } from 'react';
import { ImageItem } from '../types';

export function useQuickLook(
  images: ImageItem[], 
  onIndexChange?: (newIndex: number, newImage: ImageItem | null) => void
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const openQuickLook = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
      setIsOpen(true);
      onIndexChange?.(index, images[index] || null);
    }
  }, [images, onIndexChange]);

  const closeQuickLook = useCallback(() => {
    setIsOpen(false);
  }, []);

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => {
      const next = (prev + 1) % images.length;
      onIndexChange?.(next, images[next] || null);
      return next;
    });
  }, [images, onIndexChange]);

  const prevImage = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => {
      const next = (prev - 1 + images.length) % images.length;
      onIndexChange?.(next, images[next] || null);
      return next;
    });
  }, [images, onIndexChange]);

  // Adjust currentIndex if images array changes while open (e.g. after deleting an image)
  useEffect(() => {
    if (!isOpen) return;
    if (images.length === 0) {
      setIsOpen(false);
      return;
    }
    if (currentIndex >= images.length) {
      const nextIdx = Math.max(0, images.length - 1);
      setCurrentIndex(nextIdx);
      onIndexChange?.(nextIdx, images[nextIdx] || null);
    }
  }, [images, isOpen, currentIndex, onIndexChange]);

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
