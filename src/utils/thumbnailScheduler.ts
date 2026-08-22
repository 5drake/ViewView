// Global concurrency limiter for gallery thumbnail loads.
//
// At minimum zoom the virtual window mounts hundreds of full-resolution
// images at once; letting every <img> fire simultaneously floods the
// renderer with multi-MB IPC transfers and decode work — exactly what makes
// bulk loading stutter. Capping concurrent loads smooths allocation spikes,
// while the priority queue lets currently-visible cards jump ahead of
// scroll-buffer cards. The cap is user-configurable (Settings → 동작).

let maxConcurrentLoads = 8;

/** Runtime-configurable concurrency cap (Settings → 동작 → 동시 썸네일 로드 수). */
export function setThumbnailConcurrency(n: number): void {
  const next = Math.max(1, Math.min(64, Math.round(n) || 1));
  if (next === maxConcurrentLoads) return;
  maxConcurrentLoads = next;
  // Raising the cap starts queued jobs immediately; lowering just drains.
  pump();
}

interface QueueJob {
  run: () => void;
  priority: number; // lower = sooner
  seq: number; // FIFO tie-break within the same priority
  granted: boolean;
  cancelled: boolean;
}

let activeCount = 0;
let seqCounter = 0;
const queue: QueueJob[] = [];

function pump(): void {
  while (activeCount < maxConcurrentLoads && queue.length > 0) {
    // Stable order: viewport cards first, oldest request first within a tier.
    queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    const job = queue.shift()!;
    job.granted = true;
    activeCount++;
    job.run();
  }
}

export interface ThumbnailSlotHandle {
  /** Remove a still-queued job. No-op once granted. */
  cancel: () => void;
  /** True once a slot was granted and `run` already executed. */
  isGranted: () => boolean;
}

/**
 * Enqueue a thumbnail load. `run` is invoked when a slot is granted — set the
 * <img> src there. When the load finishes (or the card unmounts mid-load),
 * call releaseThumbnailSlot() exactly once so the next job can start.
 */
export function requestThumbnailSlot(priority: number, run: () => void): ThumbnailSlotHandle {
  const job: QueueJob = { run, priority, seq: seqCounter++, granted: false, cancelled: false };
  queue.push(job);
  pump();
  return {
    cancel: () => {
      if (job.granted || job.cancelled) return;
      job.cancelled = true;
      const i = queue.indexOf(job);
      if (i !== -1) queue.splice(i, 1);
    },
    isGranted: () => job.granted,
  };
}

/** Free the slot held by one granted load and start the next queued job. */
export function releaseThumbnailSlot(): void {
  activeCount = Math.max(0, activeCount - 1);
  pump();
}

/**
 * Consume a slot synchronously — used for URLs already known to be loaded
 * this session (virtualization remounts), which must never wait behind
 * first-time loads. Caller must still call releaseThumbnailSlot() when done.
 */
export function acquireImmediateSlot(): void {
  activeCount++;
  pump();
}
