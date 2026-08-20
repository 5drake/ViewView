# 🖼️ ViewView (뷰뷰)

> **High-Performance Zero-Crop Image Explorer & Viewer for Windows**  
> 대용량 이미지 라이브러리 및 AI 생성 이미지(ComfyUI, Stable Diffusion, Midjourney) 워크플로우를 위한 초고속 무손실 데스크톱 이미지 익스플로러

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-43+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

---

## ✨ 주요 기능 (Key Features)

### 1. ⚡ 원본 비율 무손실(Zero-Crop) 저스티파이드 갤러리
- 이미지 크롭(Crop)이나 왜곡(Distortion) 없이 원본 비율을 100% 보존하며 행 높이를 자동 균등 배분하는 고속 레이아웃 엔진
- **3가지 뷰 모드 지원**:
  - 📏 **저스티파이드 (Justified)**: 원본 비율 무크롭 행 맞춤
  - 📌 **메이슨리 (Masonry)**: 핀터레스트형 가변 높이 정렬
  - 🔲 **스퀘어 그리드 (Square Grid)**: 깔끔한 1:1 정방형 격자

### 2. 🔍 60FPS 몰입형 풀화면 퀵룩(QuickLook) 뷰어
- **더블클릭** 또는 **스페이스바(Space)**로 뷰뷰 창 전체를 채우는 다크 블러 퀵룩 모달 즉시 실행
- **마우스 커서 앵커 줌**: 마우스 휠로 커서 위치 기준 최대 **3000%(30x)** 확대/축소
- **자유 드래그 이동 (Pan / Span)**: 줌 상태에서 마우스 드래그로 끊김 없는 화면 이동
- **더블클릭 토글**: 화면 맞춤(Fit) ↔ 200% 배율 원클릭 전환
- **연속 탐색**: `←` / `→` 키 또는 사이드 버튼으로 퀵룩을 닫지 않고 이전/다음 이미지 연속 감상
- **외부 뷰어 열기**: `Enter` 키로 OS 기본 사진 뷰어 즉시 호출

### 3. 📂 윈도우 탐색기 외부 드래그 앤 드롭 & 파일 감시
- **외부 드롭 탐색**: 탐색기에서 폴더나 이미지를 뷰뷰 창 어디로든 드래그 앤 드롭하면 해당 디렉토리로 즉시 이동
- **실시간 자동 새로고침**: OS 커널 레벨 파일 시스템 감시(`fs.watch`)로 ComfyUI / SD 이미지 대량 생성 시 깜빡임 없이 실시간 반영

### 4. 📦 보관함 (Storage Vaults) 원본 복제 & 전역 단축키 커스텀
- **기존 폴더를 보관함으로 등록**: 왼쪽 사이드바의 `+` 버튼 또는 환경설정에서 실제 작업 폴더들을 원하는 만큼 보관함으로 지정
- **원클릭 / 단축키 원본 복제**: 갤러리 다중 선택 이미지(또는 퀵룩에서 보고 있는 이미지)를 지정 단축키(예: `1`, `2`, `Q`, `W` 등)로 **대상 보관함 폴더에 원본 그대로 즉시 복제**
- **비파괴 중복 방지**: 대상 폴더에 동명 파일이 존재할 경우 `name (1).ext` 형태로 자동 넘버링하여 무손실 보존
- **시각적 토스트 알림**: 복제 완료 시 화면 하단에 플로팅 토스트 배너 피드백
- **대화형 단축키 커스텀**: 환경설정에서 퀵룩, 뷰어, 패널 토글, 삭제, 탐색, 보관함 단축키를 클릭 후 원하는 키 조합으로 즉시 재설정 가능

### 5. ⭐ 가상 북마크 갤러리 & 폴더 즐겨찾기
- **북마크된 이미지 모아보기 (`bookmarks://images`)**: 여러 폴더에 분산된 즐겨찾기 이미지들을 한 화면에 가상 갤러리로 모아보기
- **폴더 북마크**: 자주 작업하는 폴더를 사이드바 상단에 즐겨찾기로 고정

### 6. 🎛️ 마우스 마키 다중 선택 & 일괄 작업
- 마우스 드래그 박스로 여러 이미지를 한 번에 선택
- 우클릭 컨텍스트 메뉴로 보관함 복제, 일괄 휴지통 이동(Delete), 일괄 복사, 일괄 북마크 처리

### 7. 🎨 EXIF 메타데이터 & AI 프롬프트 파서
- 촬영 정보(카메라 모델, 렌즈, 조리개, 셔터스피드, ISO) 표시
- 주요 6색 컬러 팔레트 및 HEX 복사
- **AI 생성 이미지 파싱**: ComfyUI / SD 생성 프롬프트, 네거티브, 시드, 모델, 샘플러 정보 자동 파싱 및 원클릭 복사

---

## ⌨️ 기본 단축키 안내 (1차 / 2차 단축키 모두 설정에서 자유롭게 커스텀 가능)

| 1차 단축키 (기본값) | 2차 보조 단축키 (기본값) | 동작 | 커스텀 가능 여부 |
|---|---|---|:---:|
| **Delete** | **D** | 선택한 파일(들) 휴지통으로 이동 | ✅ 지원 |
| **B** | **F** | 선택 이미지 북마크(⭐) 토글 | ✅ 지원 |
| **Space** / **더블클릭** | - | 퀵룩(QuickLook) 풀화면 열기 / 닫기 | ✅ 지원 |
| **Enter** | - | Windows 기본 사진 뷰어로 열기 | ✅ 지원 |
| **1, 2, 3...** | **Q, W, E... (선택)** | 선택한 이미지(들) 해당 보관함으로 원본 복제 | ✅ 지원 |
| **Ctrl + B** | - | 좌측 사이드바 접기 / 펼치기 | ✅ 지원 |
| **Ctrl + I** | - | 우측 인스펙터 패널 접기 / 펼치기 | ✅ 지원 |
| **Ctrl + ,** | - | 환경설정 및 옵션 모달 열기 | ✅ 지원 |
| **Backspace** | **Alt + ←** | 뒤로 가기 (또는 상위 폴더로 이동) | ✅ 지원 |
| **Alt + →** | - | 앞으로 가기 | ✅ 지원 |
| **Alt + ↑** | - | 상위 폴더로 이동 | ✅ 지원 |
| **마우스 보조키 (3/4번)** | - | 뒤로 가기 / 앞으로 가기 | - |
| **Ctrl + 마우스 휠** | - | 갤러리 썸네일 크기 실시간 조절 | - |

---

## 🚀 빠른 시작 (Getting Started)

### 요구 사항
- Node.js 18.0 이상
- Windows 10 / 11

### 설치 및 실행
```bash
# 저장소 클론
git clone https://github.com/5drake/ViewView.git
cd ViewView

# 의존성 패키지 설치
npm install

# 개발 모드 실행
npm run dev
```

간단하게 `run.bat` 파일을 더블클릭하여 실행할 수도 있습니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Runtime**: [Electron](https://www.electronjs.org/) (Context Isolation & Safe IPC)
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/) + `vite-plugin-electron`
- **Icons**: [Lucide React](https://lucide.dev/)
- **Metadata Parser**: [exifr](https://github.com/MikeKovarik/exifr)

---

## 📄 라이선스 (License)

이 프로젝트는 [MIT License](LICENSE)에 따라 자유롭게 사용, 수정, 배포할 수 있습니다.

Copyright (c) 2026 5drake.
