import React, { useEffect, useRef, useState } from 'react';
import { ThumbnailPlaceholder } from '../../types';
import {
  acquireImmediateSlot,
  releaseThumbnailSlot,
  requestThumbnailSlot,
} from '../../utils/thumbnailScheduler';

// ---------------------------------------------------------------------------
// Session in-memory thumbnail cache.
//
// Entries hold DOWNSCALED bitmaps (see buildThumbnailBlob below), so a fixed
// byte budget covers vastly more images than full-resolution blobs would.
// Keyed by "<media-url>|c<sizeClass>"; session-scoped, LRU-capped by bytes.
// ---------------------------------------------------------------------------
interface BlobCacheEntry {
  objectUrl: string;
  bytes: number;
}
export const THUMBNAIL_SIZE_CLASSES = [192, 384, 768, 1536];
// Runtime-configurable cache budget (Settings → 동작 → 썸네일 캐시 메모리).
let blobCacheMaxBytes = 192 * 1024 * 1024;
const blobCache = new Map<string, BlobCacheEntry>(); // insertion order = LRU order
let blobCacheBytes = 0;

/** Shrink/grow the cache budget; evicts LRU entries when shrinking. */
export function setThumbnailCacheMaxBytes(bytes: number): void {
  const next = Math.max(16 * 1024 * 1024, Math.round(bytes) || 0);
  if (next === blobCacheMaxBytes) return;
  blobCacheMaxBytes = next;
  while (blobCacheBytes > blobCacheMaxBytes && blobCache.size > 0) {
    const oldestKey = blobCache.keys().next().value as string;
    const oldest = blobCache.get(oldestKey)!;
    blobCacheBytes -= oldest.bytes;
    URL.revokeObjectURL(oldest.objectUrl);
    blobCache.delete(oldestKey);
  }
}

function cacheGet(key: string): BlobCacheEntry | undefined {
  const entry = blobCache.get(key);
  if (!entry) return undefined;
  // Refresh LRU position
  blobCache.delete(key);
  blobCache.set(key, entry);
  return entry;
}

function cachePeek(key: string): boolean {
  return blobCache.has(key);
}

function cachePut(key: string, blob: Blob): string {
  const prev = blobCache.get(key);
  if (prev) {
    blobCacheBytes -= prev.bytes;
    URL.revokeObjectURL(prev.objectUrl);
    blobCache.delete(key);
  }
  const entry: BlobCacheEntry = { objectUrl: URL.createObjectURL(blob), bytes: blob.size || 0 };
  blobCache.set(key, entry);
  blobCacheBytes += entry.bytes;
  // Evict least-recently-used entries until back under the cap.
  while (blobCacheBytes > blobCacheMaxBytes && blobCache.size > 1) {
    const oldestKey = blobCache.keys().next().value as string;
    const oldest = blobCache.get(oldestKey)!;
    blobCacheBytes -= oldest.bytes;
    URL.revokeObjectURL(oldest.objectUrl);
    blobCache.delete(oldestKey);
  }
  return entry.objectUrl;
}

/** URLs fully loaded at least once this session (may have been LRU-evicted above). */
const sessionLoadedUrls = new Set<string>();

// Keys with a fetch already in flight anywhere (card mount or folder warming).
// Guarantees a URL is never downloaded twice concurrently.
const pendingThumbnails = new Set<string>();
// Completion callbacks waiting on an in-flight key (cards mounted while a
// folder-warming fetch for the same image is already running).
const readyWaiters = new Map<string, Array<(objectUrl: string | null) => void>>();

function notifyReady(key: string, objectUrl: string | null): void {
  const waiters = readyWaiters.get(key);
  if (!waiters) return;
  readyWaiters.delete(key);
  for (const cb of waiters) cb(objectUrl);
}

interface EnqueueOptions {
  url: string;
  sizeClass: number;
  skipResize: boolean;
  priority: number;
  /** Bypass the queue entirely (already-seen URLs). */
  immediate?: boolean;
  /**
   * Called once on completion. objectUrl is the cached entry to render, or
   * null when loading failed (caller should fall back to the raw url).
   */
  onReady: (objectUrl: string | null) => void;
}

/**
 * Shared thumbnail loader for card mounts AND whole-folder warming.
 *
 * Owns the scheduler slot end-to-end (acquire → fetch → downscale → cache →
 * release), dedupes concurrent requests per cache key, and fans the result out
 * to every requester of that key — even if the requesting card unmounts
 * mid-flight the result is cached for the next remount.
 */
function enqueueThumbnail({ url, sizeClass, skipResize, priority, immediate, onReady }: EnqueueOptions): void {
  const cacheKey = skipResize ? url : `${url}|c${sizeClass}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    onReady(cached.objectUrl);
    return;
  }
  if (pendingThumbnails.has(cacheKey)) {
    // Someone is already fetching this exact bitmap — just wait for it.
    const waiters = readyWaiters.get(cacheKey);
    if (waiters) waiters.push(onReady);
    else readyWaiters.set(cacheKey, [onReady]);
    return;
  }
  pendingThumbnails.add(cacheKey);
  readyWaiters.set(cacheKey, [onReady]);

  const run = () => {
    void (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let blob = await resp.blob();
        if (!skipResize) {
          blob = await buildThumbnailBlob(blob, sizeClass);
        }
        const objectUrl = cachePut(cacheKey, blob);
        pendingThumbnails.delete(cacheKey);
        notifyReady(cacheKey, objectUrl);
      } catch {
        // Allow a later retry; callers fall back to the raw url.
        pendingThumbnails.delete(cacheKey);
        notifyReady(cacheKey, null);
      } finally {
        releaseThumbnailSlot();
      }
    })();
  };

  if (immediate) {
    acquireImmediateSlot();
    run();
  } else {
    requestThumbnailSlot(priority, () => run());
  }
}

/**
 * Decode + downscale OFF the main thread. createImageBitmap performs both on
 * Chromium's worker pool, so hundreds of concurrent first-time loads no
 * longer stall the UI thread with giant-pixel decodes.
 */
async function buildThumbnailBlob(fullBlob: Blob, targetPx: number): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(fullBlob, {
      resizeWidth: targetPx,
      resizeQuality: 'medium',
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return fullBlob;
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  } catch {
    // Formats without bitmap resize support: fall back to the original blob.
    return fullBlob;
  } finally {
    bitmap?.close();
  }
}

/**
 * Eagerly generate and cache the downscaled thumbnail for one image without
 * mounting a card. Used to pre-load the ENTIRE current folder so scrolling
 * anywhere renders instantly. No-op when already cached or in flight, and
 * runs at lower priority than visible/buffer cards.
 */
export function warmThumbnailCache(
  url: string,
  sizeClass: number,
  skipResize: boolean,
  priority: number = 2
): void {
  enqueueThumbnail({ url, sizeClass, skipResize, priority, onReady: () => {} });
}

/**
 * A single gallery thumbnail with a placeholder and scheduled
 * (concurrency-capped) loading.
 *
 * - First view: shared loader fetches ONCE → decoded/downscaled off the main
 *   thread → small JPEG cached → faded in over a configurable placeholder.
 * - Revisit (scroll away and back): src comes straight from the blob cache in
 *   the initial render — zero transfers, zero placeholder, no reload flash.
 */
export const GalleryCardImage: React.FC<{
  url: string;
  alt: string;
  /** 0 = currently intersecting the viewport, 1 = scroll buffer. Read once at enqueue time. */
  priority: number;
  /** Placeholder style from settings. */
  placeholder: ThumbnailPlaceholder;
  /** Longest-edge pixel class for the downscaled cache bitmap. */
  sizeClass: number;
  /** Formats whose animation/vector nature must not be flattened by resize. */
  skipResize: boolean;
}> = ({ url, alt, priority, placeholder, sizeClass, skipResize }) => {
  const cacheKey = skipResize ? url : `${url}|c${sizeClass}`;

  // Initializers run during first render, so a cache hit mounts the <img> WITH
  // its src on the very first commit — not even one blank frame.
  const [src, setSrc] = useState<string | null>(() => cacheGet(cacheKey)?.objectUrl ?? null);
  const [loaded, setLoaded] = useState<boolean>(() => cachePeek(cacheKey));

  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedRef = useRef(false);
  const disposedRef = useRef(false);
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    disposedRef.current = false;

    const cached = cacheGet(cacheKey);
    if (cached) {
      // Cache hit: src assigned in the initializer; just finalize state.
      setSrc(cached.objectUrl);
      setLoaded(true);
      loadedRef.current = true;
      sessionLoadedUrls.add(url);
      return () => {
        disposedRef.current = true;
      };
    }

    setSrc(null);
    setLoaded(false);

    const seenBefore = sessionLoadedUrls.has(url);
    // Already-seen URLs bypass the queue so revisits never wait behind
    // first-time loads, and regenerate without showing the placeholder.
    enqueueThumbnail({
      url,
      sizeClass,
      skipResize,
      priority: seenBefore ? 0 : priority,
      immediate: seenBefore,
      onReady: (objectUrl) => {
        if (!disposedRef.current && urlRef.current === url) {
          // null = load failed; fall back to the raw url (uncached path).
          setSrc(objectUrl ?? url);
        }
      },
    });

    return () => {
      disposedRef.current = true;
    };
  }, [url, cacheKey, sizeClass, skipResize, priority]);

  const finishLoad = () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    sessionLoadedUrls.add(url);
    setLoaded(true);
  };

  // Safety net: images can complete before React attaches onLoad.
  useEffect(() => {
    if (src && imgRef.current?.complete) {
      finishLoad();
    }
  }, [src]);

  const knownLoaded = loaded || sessionLoadedUrls.has(url);

  return (
    <div className="card-thumb-wrap">
      {!loaded && !knownLoaded && placeholder !== 'none' && (
        <div
          className={`card-skeleton${placeholder === 'solid' ? '' : ` card-skeleton--${placeholder}`}`}
          aria-hidden="true"
        />
      )}
      <img
        ref={imgRef}
        src={src ?? undefined}
        alt={alt}
        className={`card-image ${loaded ? 'loaded' : ''}`}
        decoding="async"
        draggable={false}
        onLoad={finishLoad}
        onError={finishLoad}
      />
    </div>
  );
};
