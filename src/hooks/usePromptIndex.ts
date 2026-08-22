import { useState, useEffect, useCallback } from 'react';
import { ImageItem, PromptIndexItem } from '../types';
import { parseImageExif } from '../utils/metadata';

// Global memory cache across folder navigations
const globalPromptCache = new Map<string, PromptIndexItem | null>();
const MAX_CACHE_SIZE = 5000;

// Simple LRU: deleting the oldest entry on overflow keeps the cache bounded
// even when browsing very large libraries for a long session.
function cacheSet(path: string, value: PromptIndexItem | null): void {
  globalPromptCache.delete(path); // move to end as most-recently-used
  globalPromptCache.set(path, value);
  if (globalPromptCache.size > MAX_CACHE_SIZE) {
    const oldestKey = globalPromptCache.keys().next().value;
    if (oldestKey !== undefined) globalPromptCache.delete(oldestKey);
  }
}

/**
 * Splits query string into separate search tokens by commas or spaces
 */
export function parseSearchTokens(query: string): string[] {
  if (!query || !query.trim()) return [];
  const trimmed = query.trim().toLowerCase();

  // If query contains commas, split by comma to respect multi-word tags (e.g. "1girl, blonde hair, smile")
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // Otherwise split by whitespace (e.g. "1girl blonde cat")
  return trimmed
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function usePromptIndex(images: ImageItem[]) {
  const [indexVersion, setIndexVersion] = useState<number>(0);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [indexedCount, setIndexedCount] = useState<number>(0);

  useEffect(() => {
    // Effect-local cancellation: a fresh effect run can never resurrect a
    // previous folder's indexing chain (the old shared-ref approach was reset
    // to false by the next run while the previous chain was still awaiting).
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (images.length === 0) {
      setIsIndexing(false);
      setIndexedCount(0);
      return;
    }

    // Filter unindexed images
    const unindexed = images.filter((img) => !globalPromptCache.has(img.path));
    if (unindexed.length === 0) {
      setIsIndexing(false);
      setIndexedCount(images.length);
      return;
    }

    setIsIndexing(true);
    let currentIdx = 0;
    let completedInFolder = images.length - unindexed.length;
    setIndexedCount(completedInFolder);

    const BATCH_SIZE = 6;
    const processBatch = async () => {
      if (cancelled) return;

      const batch = unindexed.slice(currentIdx, currentIdx + BATCH_SIZE);
      if (batch.length === 0) {
        setIsIndexing(false);
        setIndexedCount(images.length);
        setIndexVersion((v) => v + 1);
        return;
      }

      await Promise.all(
        batch.map(async (img) => {
          try {
            const exif = await parseImageExif(img.url, img.path);
            if (exif && (exif.aiPrompt || exif.aiCharacterPrompt || exif.aiNegativePrompt || exif.aiModel || exif.aiGenerator)) {
              cacheSet(img.path, {
                prompt: exif.aiPrompt || '',
                characterPrompt: exif.aiCharacterPrompt,
                negativePrompt: exif.aiNegativePrompt,
                model: exif.aiModel,
                sampler: exif.aiSampler,
                generator: exif.aiGenerator,
              });
            } else {
              cacheSet(img.path, null);
            }
          } catch {
            cacheSet(img.path, null);
          }
        })
      );

      completedInFolder += batch.length;
      currentIdx += BATCH_SIZE;

      if (!cancelled) {
        setIndexedCount(completedInFolder);
        setIndexVersion((v) => v + 1);
        // Small delay to yield main thread
        timer = setTimeout(processBatch, 25);
      }
    };

    timer = setTimeout(processBatch, 50);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [images]);

  // Fast prompt matching helper with multi-token AND matching
  const matchesPromptQuery = useCallback(
    (image: ImageItem, query: string): boolean => {
      const tokens = parseSearchTokens(query);
      if (tokens.length === 0) return true;

      const meta = globalPromptCache.get(image.path);
      if (!meta) return false;

      // Combine all metadata into a single searchable text blob
      const searchableBlob = [
        image.name,
        meta.prompt,
        meta.characterPrompt,
        meta.negativePrompt,
        meta.model,
        meta.sampler,
        meta.generator,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // ALL tokens must be present in the metadata (AND matching)
      return tokens.every((token: string) => searchableBlob.includes(token));
    },
    // indexVersion triggers recalculation when new prompts are indexed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexVersion]
  );

  const getPromptItem = useCallback((imagePath: string): PromptIndexItem | null => {
    return globalPromptCache.get(imagePath) || null;
  }, []);

  return {
    isIndexing,
    indexedCount,
    totalCount: images.length,
    matchesPromptQuery,
    getPromptItem,
    indexVersion,
  };
}
