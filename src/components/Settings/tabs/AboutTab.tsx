import React from 'react';
import {
  Sparkles,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { SECTION_CARD_STYLE } from './tabStyles';

const GithubIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

// GitHub quick-action button card (identical literal duplicated twice)
const LINK_BUTTON_STYLE: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--bg-surface-hover)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textAlign: 'left',
};

// Tile inside the core-technologies grid (identical literal duplicated ×4)
const TECH_CARD_STYLE: React.CSSProperties = {
  fontSize: '11px',
  padding: '8px 10px',
  background: 'var(--bg-surface)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
};

// Bold title inside a tech tile (identical literal duplicated ×4)
const TECH_TITLE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '2px',
};

// Muted description inside a tech tile (identical literal duplicated ×4)
const TECH_DESC_STYLE: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '10px',
};

interface AboutTabProps {
  onOpenLink: (url: string) => void;
}

export const AboutTab: React.FC<AboutTabProps> = ({ onOpenLink }) => {
  return (
    <>
      {/* App Identity Banner */}
      <div style={{ 
        padding: '16px', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)', 
        borderRadius: '12px', 
        border: '1px solid rgba(99, 102, 241, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ 
          width: '52px', 
          height: '52px', 
          borderRadius: '12px', 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
          flexShrink: 0,
          color: '#ffffff'
        }}>
          <Sparkles size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              ViewView (뷰뷰)
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--accent)', color: '#ffffff' }}>
              v1.0.0 Release
            </span>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              MIT License
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
            초고속 무손실(Zero-Crop) 레이아웃 엔진과 60FPS 몰입형 퀵룩 뷰어를 갖춘 오픈소스 데스크톱 이미지 익스플로러
          </div>
        </div>
      </div>

      {/* GitHub Repository Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={() => onOpenLink('https://github.com/5drake/ViewView')}
          style={LINK_BUTTON_STYLE}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GithubIcon size={20} color="var(--text-primary)" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>GitHub 저장소</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>소스코드 및 릴리즈 보기</div>
            </div>
          </div>
          <ExternalLink size={14} color="var(--text-muted)" />
        </button>

        <button
          onClick={() => onOpenLink('https://github.com/5drake/ViewView/issues')}
          style={LINK_BUTTON_STYLE}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={20} color="var(--accent)" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>이슈 & 기능 제안</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>버그 제보 및 피드백</div>
            </div>
          </div>
          <ExternalLink size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* Core Technologies & Architecture */}
      <div style={SECTION_CARD_STYLE}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={14} color="var(--accent)" />
          <span>주요 아키텍처 및 핵심 기술</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={TECH_CARD_STYLE}>
            <div style={TECH_TITLE_STYLE}>⚡ Zero-Crop Justified Engine</div>
            <div style={TECH_DESC_STYLE}>원본 비율 100% 무손실 동적 갤러리 계산</div>
          </div>
          <div style={TECH_CARD_STYLE}>
            <div style={TECH_TITLE_STYLE}>🔍 60FPS QuickLook Viewer</div>
            <div style={TECH_DESC_STYLE}>커서 앵커 줌(최대 30x) & 드래그 팬</div>
          </div>
          <div style={TECH_CARD_STYLE}>
            <div style={TECH_TITLE_STYLE}>📦 Storage Vaults & Cloner</div>
            <div style={TECH_DESC_STYLE}>단축키 원본 복제 & 중복 파일명 회피</div>
          </div>
          <div style={TECH_CARD_STYLE}>
            <div style={TECH_TITLE_STYLE}>🎨 EXIF & AI Metadata Parser</div>
            <div style={TECH_DESC_STYLE}>프롬프트/시드 파싱 & 주요 색상 팔레트</div>
          </div>
        </div>
      </div>

      {/* Open-Source Dependencies Credits */}
      <div style={SECTION_CARD_STYLE}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} color="var(--accent)" />
          <span>오픈소스 라이브러리 및 크레딧</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { name: 'Electron', author: 'OpenJS Foundation', license: 'MIT License', desc: 'Cross-platform desktop application framework' },
            { name: 'React 19 & TypeScript', author: 'Meta & Microsoft', license: 'MIT / Apache-2.0', desc: 'Type-safe reactive component UI library' },
            { name: 'Vite', author: 'Evan You & Vite Contributors', license: 'MIT License', desc: 'Next generation ultra-fast frontend tooling' },
            { name: 'Lucide Icons', author: 'Lucide Project', license: 'ISC License', desc: 'Beautiful & consistent pixel-perfect icon set' },
            { name: 'exifr', author: 'Mike Kovarik', license: 'MIT License', desc: 'Comprehensive fast image metadata parser' },
          ].map((dep) => (
            <div 
              key={dep.name} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '6px 8px', 
                background: 'var(--bg-surface)', 
                borderRadius: '6px', 
                border: '1px solid var(--border-subtle)',
                fontSize: '11px'
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dep.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '10px' }}>({dep.author})</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '10px', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: '4px' }}>
                {dep.license}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* License Notice */}
      <div style={{ 
        textAlign: 'center', 
        padding: '12px 10px', 
        fontSize: '11px', 
        color: 'var(--text-muted)', 
        lineHeight: '1.6',
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Free and Open Source Software under MIT License</span>
        </div>
        <div>Copyright © 2026 5drake. Built with ❤️ for image creators and power users.</div>
      </div>
    </>
  );
};

export default AboutTab;
