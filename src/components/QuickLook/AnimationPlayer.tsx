import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge, Film } from 'lucide-react';
import { isTopmostModal } from '../../utils/modalStack';

interface AnimationPlayerProps {
  imageUrl: string;
  isAnimated: boolean;
  scale: number;
  offset: { x: number; y: number };
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onFrameChange?: (currentFrame: number, totalFrames: number) => void;
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  imageUrl,
  isAnimated,
  scale,
  offset,
  isDragging,
  onMouseDown,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hasDecoded, setHasDecoded] = useState<boolean>(false);

  const decoderRef = useRef<any>(null);
  const frameDurationsRef = useRef<number[]>([]);
  const animationTimerRef = useRef<number | null>(null);
  const currentFrameRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const playbackSpeedRef = useRef<number>(1);

  currentFrameRef.current = currentFrame;
  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;

  // Draw a specific decoded frame to canvas. Monotonic sequence token: when a
  // decode is slower than the timer delay the draws would overlap and frames
  // could paint out of order (backwards flicker on heavy GIFs) — a stale draw
  // is dropped as soon as a newer one is requested.
  const drawSeqRef = useRef(0);
  const drawFrame = useCallback(async (frameIndex: number) => {
    if (!decoderRef.current || !canvasRef.current) return;
    const seq = ++drawSeqRef.current;
    try {
      const { image } = await decoderRef.current.decode({ frameIndex });
      if (seq !== drawSeqRef.current) {
        image.close();
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        image.close();
        return;
      }

      if (canvas.width !== image.displayWidth || canvas.height !== image.displayHeight) {
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
      }
      image.close();
    } catch {
      // Decode error or frame skipped
    }
  }, []);

  // Initialize WebCodecs ImageDecoder
  useEffect(() => {
    if (!isAnimated) {
      setHasDecoded(false);
      return;
    }

    let isMounted = true;
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);

    const initDecoder = async () => {
      try {
        if (!('ImageDecoder' in window)) {
          setHasDecoded(false);
          return;
        }

        const res = await fetch(imageUrl);
        const buffer = await res.arrayBuffer();
        if (!isMounted) return;

        const isGif = imageUrl.toLowerCase().includes('.gif');
        const isWebp = imageUrl.toLowerCase().includes('.webp');
        const type = isGif ? 'image/gif' : isWebp ? 'image/webp' : 'image/png';

        const decoder = new (window as any).ImageDecoder({
          data: buffer,
          type,
        });

        await decoder.tracks.ready;
        if (!isMounted) return;

        const track = decoder.tracks.selectedTrack;
        const count = track ? track.frameCount : 1;

        // Populate real per-frame durations (ms): decode each frame once,
        // read its VideoFrame.timestamp (microseconds), and derive each
        // duration from the delta to the next frame's timestamp. Frames with
        // invalid deltas stay unset so playback falls back to its default.
        const precomputeFrameDurations = async () => {
          const stamps: number[] = [];
          for (let i = 0; i < count; i++) {
            try {
              const { image } = await decoder.decode({ frameIndex: i });
              stamps.push(typeof image.timestamp === 'number' ? image.timestamp : NaN);
              image.close();
            } catch {
              break; // stop early; unstamped frames keep the default delay
            }
            if (!isMounted || decoderRef.current !== decoder) return;
          }

          const gaps: number[] = [];
          let lastDelta = 0;
          let prev: number | undefined;
          for (const ts of stamps) {
            if (prev !== undefined) {
              const deltaMs = (ts - prev) / 1000;
              if (Number.isFinite(deltaMs) && deltaMs > 0) {
                gaps.push(deltaMs);
                lastDelta = deltaMs;
              } else {
                gaps.push(0);
              }
            }
            prev = ts;
          }

          // Last frame: reuse the previous delta, else the track-level
          // duration/frameCount when the track reports one.
          let tail = lastDelta;
          if (
            !(tail > 0) &&
            track &&
            typeof track.duration === 'number' &&
            Number.isFinite(track.duration) &&
            track.duration > 0
          ) {
            const avgMs = track.duration / count / 1000;
            if (Number.isFinite(avgMs) && avgMs > 0) tail = avgMs;
          }

          if (!isMounted || decoderRef.current !== decoder) return;
          frameDurationsRef.current = [...gaps, tail > 0 ? tail : 0];
        };

        if (count > 1) {
          decoderRef.current = decoder;
          frameDurationsRef.current = [];
          precomputeFrameDurations();
          setTotalFrames(count);
          setCurrentFrame(0);
          setHasDecoded(true);
          setIsPlaying(true);

          // Draw first frame
          drawFrame(0);
        } else {
          setHasDecoded(false);
        }
      } catch {
        if (isMounted) setHasDecoded(false);
      }
    };

    initDecoder();

    return () => {
      isMounted = false;
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      frameDurationsRef.current = [];
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
      }
    };
  }, [imageUrl, isAnimated, drawFrame]);

  // Frame animation loop
  useEffect(() => {
    if (!hasDecoded || !isPlaying || totalFrames <= 1 || isScrubbing) {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      return;
    }

    const stepAnimation = () => {
      const next = (currentFrameRef.current + 1) % totalFrames;
      setCurrentFrame(next);
      drawFrame(next);

      // Default to 100ms (10fps) or duration divided by speed
      const baseDelay = frameDurationsRef.current[next] || 80;
      const delay = Math.max(16, baseDelay / playbackSpeedRef.current);

      animationTimerRef.current = window.setTimeout(stepAnimation, delay);
    };

    const delay = Math.max(16, 80 / playbackSpeedRef.current);
    animationTimerRef.current = window.setTimeout(stepAnimation, delay);

    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, [hasDecoded, isPlaying, totalFrames, isScrubbing, drawFrame]);

  // Step 1 frame forward or backward
  const handleStepFrame = useCallback((delta: number) => {
    setIsPlaying(false);
    setCurrentFrame((prev) => {
      let next = prev + delta;
      if (next < 0) next = totalFrames - 1;
      if (next >= totalFrames) next = 0;
      drawFrame(next);
      return next;
    });
  }, [totalFrames, drawFrame]);

  // Global keybindings for animation controls: Space / K (Play/Pause), [ / ] (Prev/Next Frame)
  useEffect(() => {
    if (!hasDecoded) return;

    const handleKey = (e: KeyboardEvent) => {
      if (!isTopmostModal('quicklook')) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === '[' || e.key === ',') {
        e.preventDefault();
        handleStepFrame(-1);
      } else if (e.key === ']' || e.key === '.') {
        e.preventDefault();
        handleStepFrame(1);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasDecoded, handleStepFrame]);

  return (
    <>
      {/* Visual Canvas (when decoded frame is active) or Native IMG fallback */}
      {hasDecoded ? (
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
            maxWidth: scale === 1 ? '92vw' : 'none',
            maxHeight: scale === 1 ? '86vh' : 'none',
            objectFit: 'contain',
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
            borderRadius: '4px',
            willChange: 'transform',
          }}
        />
      ) : (
        <img
          src={imageUrl}
          alt=""
          onMouseDown={onMouseDown}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
            maxWidth: scale === 1 ? '92vw' : 'none',
            maxHeight: scale === 1 ? '86vh' : 'none',
            objectFit: 'contain',
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
            borderRadius: '4px',
            willChange: 'transform',
          }}
        />
      )}

      {/* Floating Animation Controller Bar */}
      {hasDecoded && totalFrames > 1 && (
        <div
          className="animation-controller-bar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Badge */}
          <div className="anim-badge">
            <Film size={12} color="#a855f7" />
            <span>ANIM</span>
          </div>

          {/* Play / Pause Toggle */}
          <button
            className="anim-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              setIsPlaying((p) => !p);
            }}
            title={isPlaying ? '일시정지 [K]' : '재생 [K]'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Previous Frame */}
          <button
            className="anim-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              handleStepFrame(-1);
            }}
            title="이전 프레임 [ 또는 ,]"
          >
            <SkipBack size={13} />
          </button>

          {/* Frame Scrubber Bar */}
          <div className="anim-scrubber-wrapper">
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onMouseDown={() => setIsScrubbing(true)}
              onMouseUp={(e) => {
                setIsScrubbing(false);
                (e.currentTarget as HTMLElement)?.blur();
              }}
              onChange={(e) => {
                const f = Number(e.target.value);
                setCurrentFrame(f);
                drawFrame(f);
              }}
              className="anim-scrubber"
            />
          </div>

          {/* Next Frame */}
          <button
            className="anim-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              handleStepFrame(1);
            }}
            title="다음 프레임 ] 또는 .]"
          >
            <SkipForward size={13} />
          </button>

          {/* Frame Counter */}
          <span className="anim-counter">
            <strong>{currentFrame + 1}</strong> / {totalFrames}
          </span>

          {/* Speed Presets */}
          <div className="anim-speed-control">
            <Gauge size={12} color="var(--text-muted)" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="anim-speed-select"
              title="재생 배속 조절"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>
        </div>
      )}
    </>
  );
};
