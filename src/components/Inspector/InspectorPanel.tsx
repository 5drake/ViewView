import React, { useState, useEffect, useRef } from 'react';
import { 
  Info, 
  Camera, 
  Palette, 
  Activity, 
  ExternalLink, 
  FolderOpen, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles,
  Layers,
  Star
} from 'lucide-react';
import { ImageItem, ExifData, ColorPaletteItem, ToastType } from '../../types';
import type { ConfirmFn } from '../Common/ConfirmDialog';
import { parseImageExif, analyzeImageColors } from '../../utils/metadata';

interface InspectorProps {
  image: ImageItem | null;
  onOpenViewer?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (filePath: string) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  confirm?: ConfirmFn;
  collapsed?: boolean;
}

export const InspectorPanel: React.FC<InspectorProps> = ({ 
  image, 
  isBookmarked = false, 
  onToggleBookmark,
  onShowToast,
  confirm,
  collapsed = false,
}) => {
  const [exif, setExif] = useState<ExifData | null>(null);
  const [palette, setPalette] = useState<ColorPaletteItem[]>([]);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedCharPrompt, setCopiedCharPrompt] = useState<boolean>(false);
  const [copiedNegPrompt, setCopiedNegPrompt] = useState<boolean>(false);
  const [histogram, setHistogram] = useState<{ r: number[]; g: number[]; b: number[]; l: number[] } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Managed "copied" indicator timers so quick successive copies (or switching
  // images) can't leave a stale timer clearing a newer flag or firing after
  // unmount.
  const copiedTimersRef = useRef<Partial<Record<'hex' | 'prompt' | 'char' | 'neg', ReturnType<typeof setTimeout>>>>({});
  const startCopiedTimer = (field: 'hex' | 'prompt' | 'char' | 'neg', clear: () => void) => {
    const prev = copiedTimersRef.current[field];
    if (prev) clearTimeout(prev);
    copiedTimersRef.current[field] = setTimeout(clear, 1500);
  };
  useEffect(() => () => {
    Object.values(copiedTimersRef.current).forEach((t) => { if (t) clearTimeout(t); });
  }, []);

  useEffect(() => {
    if (!image) {
      setExif(null);
      setPalette([]);
      setHistogram(null);
      return;
    }

    let isMounted = true;

    // Load EXIF
    parseImageExif(image.url, image.path).then((data) => {
      if (isMounted) setExif(data);
    });

    // Load Colors & Histogram
    analyzeImageColors(image.url).then((res) => {
      if (isMounted && res) {
        setPalette(res.palette);
        setHistogram(res.histogram);
      }
    });

    return () => {
      isMounted = false;
    };
    // Depend on the URL, not object identity: parent state changes (bookmark
    // toggles, list refreshes) rebuild ImageItem objects and previously
    // re-ran a full EXIF parse + image decode + histogram pass for the SAME file.
  }, [image?.url]);

  // Reset UI state when switching to a different image
  useEffect(() => {
    setExif(null);
    setPalette([]);
    setHistogram(null);
  }, [image?.url]);

  // Draw Histogram to Canvas
  useEffect(() => {
    if (!histogram || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw Luminance
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - histogram.l[i] * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Red
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - histogram.r[i] * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Green
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - histogram.g[i] * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Blue
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - histogram.b[i] * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [histogram]);

  const copyToClipboard = (text: string, isHex = false) => {
    if (window.electronAPI?.copyTextToClipboard) {
      window.electronAPI.copyTextToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    if (isHex) {
      setCopiedHex(text);
      onShowToast?.(`색상 코드 [${text}]가 복사되었습니다.`, 'copy');
      startCopiedTimer('hex', () => setCopiedHex(null));
    } else {
      setCopiedPrompt(true);
      onShowToast?.('AI 생성 프롬프트가 복사되었습니다.', 'copy');
      startCopiedTimer('prompt', () => setCopiedPrompt(false));
    }
  };

  const copyPromptField = (text: string, type: 'prompt' | 'char' | 'neg', label: string) => {
    if (window.electronAPI?.copyTextToClipboard) {
      window.electronAPI.copyTextToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    if (type === 'prompt') {
      setCopiedPrompt(true);
      startCopiedTimer('prompt', () => setCopiedPrompt(false));
    } else if (type === 'char') {
      setCopiedCharPrompt(true);
      startCopiedTimer('char', () => setCopiedCharPrompt(false));
    } else if (type === 'neg') {
      setCopiedNegPrompt(true);
      startCopiedTimer('neg', () => setCopiedNegPrompt(false));
    }
    onShowToast?.(`${label}이(가) 복사되었습니다.`, 'copy');
  };

  const handleShowInFolder = () => {
    if (image && window.electronAPI) {
      window.electronAPI.showInFolder(image.path);
    }
  };

  const handleOpenDefault = () => {
    if (image && window.electronAPI) {
      window.electronAPI.openWithDefault(image.path);
    }
  };

  const handleTrash = async () => {
    if (!image || !window.electronAPI) return;

    const ok = confirm
      ? await confirm({
          title: '휴지통으로 이동',
          message: `'${image.name}' 파일을 휴지통으로 이동하시겠습니까?`,
          confirmLabel: '휴지통으로 이동',
          danger: true,
        })
      : window.confirm(`'${image.name}' 파일을 휴지통으로 이동하시겠습니까?`);

    if (!ok) return;
    await window.electronAPI.trashFile(image.path);
    onShowToast?.('파일이 휴지통으로 이동되었습니다.', 'trash');
  };

  if (!image) {
    return (
      <aside className={`app-inspector ${collapsed ? 'collapsed' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <Info size={22} color="var(--text-muted)" style={{ opacity: 0.6 }} />
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
          선택된 항목 없음
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '180px' }}>
          이미지를 클릭하거나 드래그하여 상세 정보를 확인하세요
        </div>
      </aside>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <aside className={`app-inspector ${collapsed ? 'collapsed' : ''}`}>
      {/* Mini Preview */}
      <div 
        style={{ 
          position: 'relative', 
          borderRadius: '8px', 
          overflow: 'hidden', 
          cursor: 'pointer',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)'
        }}
        onClick={handleOpenDefault}
        title="클릭하여 기본 뷰어로 열기 (더블클릭 / Enter)"
      >
        <img 
          src={image.url} 
          alt={image.name} 
          style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }} 
        />
        <div 
          style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'rgba(0,0,0,0.3)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            opacity: 0, 
            transition: 'opacity 0.15s ease' 
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '4px' }}>
            크게 보기 (Enter)
          </span>
        </div>
      </div>

      {/* Basic File Info */}
      <div className="inspector-card">
        <div className="inspector-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} color="var(--accent)" />
            <span>파일 정보</span>
          </div>
          {onToggleBookmark && (
            <button
              onClick={() => onToggleBookmark(image.path)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: isBookmarked ? '#fbbf24' : 'var(--text-muted)',
                padding: '2px',
              }}
              title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Star size={16} fill={isBookmarked ? '#fbbf24' : 'transparent'} color="#fbbf24" />
            </button>
          )}
        </div>
        <div className="inspector-row">
          <span className="inspector-label">파일명</span>
          <span className="inspector-value" title={image.name}>{image.name}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">형식</span>
          <span className="inspector-value">{image.extension}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">해상도</span>
          <span className="inspector-value">{image.width} × {image.height} px</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">종횡비</span>
          <span className="inspector-value">{image.aspectRatio}:1</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">파일 크기</span>
          <span className="inspector-value">{formatSize(image.size)}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">수정일시</span>
          <span className="inspector-value">{new Date(image.modifiedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Color Palette & Histogram */}
      <div className="inspector-card">
        <div className="inspector-title">
          <Palette size={14} color="#ec4899" />
          <span>대표 컬러 & 히스토그램</span>
        </div>

        {/* Palette Swatches */}
        {palette.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              도미넌트 컬러 팔레트 (클릭 시 복사):
            </div>
            <div className="palette-container">
              {palette.map((p) => (
                <div
                  key={p.hex}
                  className="palette-swatch"
                  style={{ backgroundColor: p.hex }}
                  title={`${p.hex} (${p.percent}%) - 클릭하여 HEX 복사`}
                  onClick={() => copyToClipboard(p.hex, true)}
                >
                  {copiedHex === p.hex && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: '4px' }}>
                      <Check size={12} color="#fff" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RGB Histogram */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={11} />
            <span>RGB / Luminance 분포</span>
          </div>
          <canvas ref={canvasRef} width={260} height={70} className="histogram-canvas" />
        </div>
      </div>

      {/* EXIF Camera Info */}
      {exif && (exif.model || exif.iso || exif.fNumber) && (
        <div className="inspector-card">
          <div className="inspector-title">
            <Camera size={14} color="#38bdf8" />
            <span>카메라 EXIF</span>
          </div>
          {exif.model && (
            <div className="inspector-row">
              <span className="inspector-label">카메라</span>
              <span className="inspector-value">{exif.make ? `${exif.make} ` : ''}{exif.model}</span>
            </div>
          )}
          {exif.lens && (
            <div className="inspector-row">
              <span className="inspector-label">렌즈</span>
              <span className="inspector-value">{exif.lens}</span>
            </div>
          )}
          {exif.focalLength && (
            <div className="inspector-row">
              <span className="inspector-label">초점거리</span>
              <span className="inspector-value">{exif.focalLength}</span>
            </div>
          )}
          {exif.fNumber && (
            <div className="inspector-row">
              <span className="inspector-label">조리개</span>
              <span className="inspector-value">{exif.fNumber}</span>
            </div>
          )}
          {exif.exposureTime && (
            <div className="inspector-row">
              <span className="inspector-label">셔터스피드</span>
              <span className="inspector-value">{exif.exposureTime}</span>
            </div>
          )}
          {exif.iso && (
            <div className="inspector-row">
              <span className="inspector-label">ISO</span>
              <span className="inspector-value">{exif.iso}</span>
            </div>
          )}
        </div>
      )}

      {/* AI Prompt Metadata (NovelAI / ComfyUI / SD WebUI / Midjourney) */}
      {exif && (exif.aiPrompt || exif.aiModel || exif.aiSeed || exif.aiGenerator) && (
        <div className="inspector-card" style={{ borderColor: 'rgba(168, 85, 247, 0.4)' }}>
          <div className="inspector-title" style={{ color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} />
              <span>AI 생성 메타데이터</span>
            </div>
            {exif.aiGenerator && (
              <span style={{ 
                fontSize: '9.5px', 
                fontWeight: 700, 
                color: '#e0e7ff', 
                background: 'rgba(99, 102, 241, 0.35)', 
                border: '1px solid rgba(99, 102, 241, 0.5)',
                padding: '1px 6px', 
                borderRadius: '10px' 
              }}>
                {exif.aiGenerator}
              </span>
            )}
          </div>

          {exif.aiPrompt && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#c084fc' }}>🌟 긍정 프롬프트</span>
                <button
                  onClick={() => copyPromptField(exif.aiPrompt || '', 'prompt', '긍정 프롬프트')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                  title="긍정 프롬프트 복사"
                >
                  {copiedPrompt ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                  <span>{copiedPrompt ? '복사됨' : '복사'}</span>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-primary)', maxHeight: '90px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', lineHeight: '1.4' }}>
                {exif.aiPrompt}
              </div>
            </div>
          )}

          {exif.aiCharacterPrompt && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#38bdf8' }}>👤 캐릭터 프롬프트</span>
                <button
                  onClick={() => copyPromptField(exif.aiCharacterPrompt || '', 'char', '캐릭터 프롬프트')}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                  title="캐릭터 프롬프트 복사"
                >
                  {copiedCharPrompt ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                  <span>{copiedCharPrompt ? '복사됨' : '복사'}</span>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-primary)', maxHeight: '70px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', lineHeight: '1.4' }}>
                {exif.aiCharacterPrompt}
              </div>
            </div>
          )}

          {exif.aiNegativePrompt && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#f87171' }}>🚫 부정 프롬프트</span>
                <button
                  onClick={() => copyPromptField(exif.aiNegativePrompt || '', 'neg', '부정 프롬프트')}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                  title="부정 프롬프트 복사"
                >
                  {copiedNegPrompt ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                  <span>{copiedNegPrompt ? '복사됨' : '복사'}</span>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', maxHeight: '60px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', lineHeight: '1.4' }}>
                {exif.aiNegativePrompt}
              </div>
            </div>
          )}

          {exif.aiModel && (
            <div className="inspector-row" style={{ marginTop: '6px' }}>
              <span className="inspector-label">모델</span>
              <span className="inspector-value" style={{ color: '#c084fc', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exif.aiModel}>{exif.aiModel}</span>
            </div>
          )}
          {exif.aiSampler && (
            <div className="inspector-row">
              <span className="inspector-label">Sampler</span>
              <span className="inspector-value">{exif.aiSampler}</span>
            </div>
          )}
          {exif.aiSteps && (
            <div className="inspector-row">
              <span className="inspector-label">Steps</span>
              <span className="inspector-value">{exif.aiSteps}</span>
            </div>
          )}
          {exif.aiCfg && (
            <div className="inspector-row">
              <span className="inspector-label">CFG</span>
              <span className="inspector-value">{exif.aiCfg}</span>
            </div>
          )}
          {exif.aiNoiseSchedule && (
            <div className="inspector-row">
              <span className="inspector-label">Schedule</span>
              <span className="inspector-value">{exif.aiNoiseSchedule}</span>
            </div>
          )}
          {exif.aiSmea && (
            <div className="inspector-row">
              <span className="inspector-label">SMEA</span>
              <span className="inspector-value">{exif.aiSmea}</span>
            </div>
          )}
          {exif.aiSeed && (
            <div className="inspector-row">
              <span className="inspector-label">Seed</span>
              <span className="inspector-value">{exif.aiSeed}</span>
            </div>
          )}
        </div>
      )}

      {/* Windows Explorer & Shell Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          className="nav-btn"
          style={{ flex: 1, padding: '7px 10px', fontSize: '12px', gap: '6px', background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)' }}
          onClick={handleOpenDefault}
          title="PC 기본 사진 뷰어로 열기 (더블클릭 / Enter)"
        >
          <ExternalLink size={14} />
          <span>기본 뷰어로 열기</span>
        </button>
        <button
          className="nav-btn"
          style={{ padding: '7px 10px', fontSize: '12px', gap: '6px' }}
          onClick={handleShowInFolder}
          title="Windows 탐색기 위치에서 열기"
        >
          <FolderOpen size={14} />
          <span>탐색기</span>
        </button>
        <button
          className="nav-btn"
          style={{ padding: '7px 10px', color: '#f87171' }}
          onClick={handleTrash}
          title="휴지통으로 이동"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </aside>
  );
};
