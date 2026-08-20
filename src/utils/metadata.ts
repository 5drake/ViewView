import exifr from 'exifr';
import { ExifData, ColorPaletteItem } from '../types';

/**
 * Reads PNG tEXt and iTXt chunks directly from an ArrayBuffer for 100% reliable metadata recovery
 */
function extractPngMetadata(buffer: ArrayBuffer): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const view = new DataView(buffer);
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) {
      return result;
    }

    let offset = 8;
    const len = buffer.byteLength;
    const decoder = new TextDecoder('utf-8');

    while (offset + 8 < len) {
      const chunkLength = view.getUint32(offset);
      const chunkType = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (chunkType === 'IEND') break;

      if (chunkType === 'tEXt') {
        const chunkData = new Uint8Array(buffer, offset + 8, chunkLength);
        let nullIdx = 0;
        while (nullIdx < chunkData.length && chunkData[nullIdx] !== 0) {
          nullIdx++;
        }
        const key = decoder.decode(chunkData.subarray(0, nullIdx));
        const value = decoder.decode(chunkData.subarray(nullIdx + 1));
        result[key] = value;
      } else if (chunkType === 'iTXt') {
        const chunkData = new Uint8Array(buffer, offset + 8, chunkLength);
        let nullIdx = 0;
        while (nullIdx < chunkData.length && chunkData[nullIdx] !== 0) {
          nullIdx++;
        }
        const key = decoder.decode(chunkData.subarray(0, nullIdx));
        // iTXt format: keyword\0 compFlag(1B) compMethod(1B) langTag\0 transKey\0 text
        let pos = nullIdx + 3;
        while (pos < chunkData.length && chunkData[pos] !== 0) pos++;
        pos++;
        while (pos < chunkData.length && chunkData[pos] !== 0) pos++;
        pos++;
        if (pos < chunkData.length) {
          const value = decoder.decode(chunkData.subarray(pos));
          result[key] = value;
        }
      }

      offset += 12 + chunkLength;
    }
  } catch (e) {
    // Ignore buffer reading errors
  }
  return result;
}

/**
 * Safely parses JSON strings even if they contain Python NaN, Infinity, or formatting quirks
 */
function safeJsonParse(str: string): any {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const sanitized = str
        .replace(/:\s*NaN\b/g, ': null')
        .replace(/\[\s*NaN\s*\]/g, '[null]')
        .replace(/,\s*NaN\b/g, ', null')
        .replace(/\bNaN\b/g, 'null')
        .replace(/:\s*Infinity\b/g, ': null')
        .replace(/:\s*-Infinity\b/g, ': null');
      return JSON.parse(sanitized);
    } catch {
      return null;
    }
  }
}

/**
 * Parses ComfyUI execution graph or workflow JSON
 */
function parseComfyUIGraph(graph: Record<string, any>, exif: ExifData): boolean {
  try {
    const positivePrompts: string[] = [];
    const negativePrompts: string[] = [];

    for (const nodeKey of Object.keys(graph)) {
      const node = graph[nodeKey];
      if (!node || typeof node !== 'object') continue;

      const classType = (node.class_type || '').toLowerCase();
      const inputs = node.inputs || {};

      // 1. KSampler nodes (seed, steps, cfg, sampler_name)
      if (classType.includes('sampler')) {
        if (inputs.seed !== undefined && !exif.aiSeed) exif.aiSeed = String(inputs.seed);
        if (inputs.noise_seed !== undefined && !exif.aiSeed) exif.aiSeed = String(inputs.noise_seed);
        if (inputs.steps !== undefined && !exif.aiSteps) exif.aiSteps = String(inputs.steps);
        if (inputs.cfg !== undefined && !exif.aiCfg) exif.aiCfg = String(inputs.cfg);
        if (inputs.cfg_scale !== undefined && !exif.aiCfg) exif.aiCfg = String(inputs.cfg_scale);
        if (inputs.sampler_name && !exif.aiSampler) exif.aiSampler = String(inputs.sampler_name);
      }

      // 2. Model / UNet loaders
      if (classType.includes('loader') || classType.includes('unet') || classType.includes('checkpoint')) {
        if (inputs.unet_name && !exif.aiModel) exif.aiModel = String(inputs.unet_name);
        else if (inputs.ckpt_name && !exif.aiModel) exif.aiModel = String(inputs.ckpt_name);
        else if (inputs.model_name && !exif.aiModel) exif.aiModel = String(inputs.model_name);
      }

      // 3. PromptStudio / Anima / EasyUse advanced_fields
      if (inputs.advanced_fields) {
        const rawFields = typeof inputs.advanced_fields === 'string'
          ? safeJsonParse(inputs.advanced_fields)
          : inputs.advanced_fields;

        if (Array.isArray(rawFields)) {
          for (const field of rawFields) {
            if (field && typeof field === 'object' && field.text) {
              const text = String(field.text).trim();
              if (!text) continue;

              // Only include enabled prompts (default enabled if missing or true)
              if (field.enabled === false) continue;

              const pane = (field.pane || '').toLowerCase();
              const type = (field.type || '').toLowerCase();
              const id = (field.id || '').toLowerCase();

              if (pane.includes('pos') || type.includes('pos') || id.startsWith('positive_') || id.includes('pos')) {
                positivePrompts.push(text);
              } else if (pane.includes('neg') || type.includes('neg') || id.startsWith('negative_') || id.includes('neg')) {
                negativePrompts.push(text);
              } else {
                if (
                  text.toLowerCase().includes('worst quality') ||
                  text.toLowerCase().includes('low quality') ||
                  text.toLowerCase().includes('score_1')
                ) {
                  negativePrompts.push(text);
                } else {
                  positivePrompts.push(text);
                }
              }
            }
          }
        }
      }

      // 4. Dedicated Prompt text inputs
      if (inputs.text_positive && typeof inputs.text_positive === 'string') {
        positivePrompts.push(inputs.text_positive.trim());
      }
      if (inputs.text_negative && typeof inputs.text_negative === 'string') {
        negativePrompts.push(inputs.text_negative.trim());
      }
      if (inputs.positive_prompt && typeof inputs.positive_prompt === 'string') {
        positivePrompts.push(inputs.positive_prompt.trim());
      }
      if (inputs.negative_prompt && typeof inputs.negative_prompt === 'string') {
        negativePrompts.push(inputs.negative_prompt.trim());
      }

      // 5. Standard CLIPTextEncode / Prompt nodes
      if (
        classType.includes('cliptextencode') ||
        classType.includes('sdprompt') ||
        classType.includes('effprompt') ||
        classType.includes('prompt') ||
        classType.includes('text')
      ) {
        const promptCandidate = inputs.text || inputs.prompt || inputs.string || inputs.prompt_text;
        if (typeof promptCandidate === 'string' && promptCandidate.trim()) {
          const text = promptCandidate.trim();
          const lower = text.toLowerCase();
          if (
            lower.includes('worst quality') ||
            lower.includes('low quality') ||
            lower.includes('score_1') ||
            lower.includes('bad anatomy') ||
            lower.includes('embedding:')
          ) {
            negativePrompts.push(text);
          } else {
            positivePrompts.push(text);
          }
        }
      }
    }

    if (positivePrompts.length > 0) {
      exif.aiPrompt = positivePrompts.join(', ');
    }
    if (negativePrompts.length > 0) {
      exif.aiNegativePrompt = negativePrompts.join(', ');
    }

    return Boolean(exif.aiPrompt || exif.aiNegativePrompt || exif.aiModel || exif.aiSeed);
  } catch {
    return false;
  }
}

/**
 * Cleans up raw prompt strings by removing carriage returns and excessive whitespace/commas
 */
function cleanPromptText(text: any): string {
  if (!text) return '';
  return String(text)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim()
    .replace(/,+$/, '')
    .trim();
}

/**
 * Detects AI Generator Tool and extracts prompts & parameters (NovelAI, ComfyUI, WebUI, etc.)
 */
function detectAndParseAIMetadata(meta: Record<string, any>, exif: ExifData): void {
  const software = String(meta.Software || meta.software || '').toLowerCase();
  const source = String(meta.Source || meta.source || '');

  // 1. NovelAI (NAI) Detector
  const commentCandidate = meta.Comment || meta.Description || meta.userComment || meta.UserComment || '';
  const commentStr = typeof commentCandidate === 'string' 
    ? commentCandidate 
    : typeof commentCandidate === 'object' 
      ? JSON.stringify(commentCandidate) 
      : String(commentCandidate);

  const isNovelAI =
    software.includes('novelai') ||
    source.toLowerCase().includes('novelai') ||
    commentStr.includes('signed_hash') ||
    commentStr.includes('request_type') ||
    (commentStr.includes('"prompt"') && commentStr.includes('"uc"'));

  if (isNovelAI) {
    exif.aiGenerator = source ? `NovelAI (${source})` : 'NovelAI';
    const parsed = safeJsonParse(commentStr);
    if (parsed && typeof parsed === 'object') {
      if (parsed.prompt) exif.aiPrompt = cleanPromptText(parsed.prompt);

      // NovelAI character caption/prompt
      const charCaption = parsed.char_caption || parsed.character_caption || parsed.character_prompt || parsed.characterCaption;
      if (charCaption) {
        exif.aiCharacterPrompt = cleanPromptText(charCaption);
      }

      if (parsed.uc) exif.aiNegativePrompt = cleanPromptText(parsed.uc);
      if (parsed.steps !== undefined) exif.aiSteps = String(parsed.steps);
      if (parsed.sampler) exif.aiSampler = String(parsed.sampler);
      if (parsed.seed !== undefined) exif.aiSeed = String(parsed.seed);
      if (parsed.scale !== undefined) exif.aiCfg = String(parsed.scale);
      if (parsed.noise_schedule) exif.aiNoiseSchedule = String(parsed.noise_schedule);
      if (parsed.sm) exif.aiSmea = parsed.sm_dyn ? 'SMEA + DYN' : 'SMEA';
      return;
    }
  }

  // 2. ComfyUI Detector
  const promptCandidate = meta.prompt || meta.workflow || meta.parameters || meta.UserComment || '';
  const promptStr = typeof promptCandidate === 'string'
    ? promptCandidate
    : typeof promptCandidate === 'object'
      ? JSON.stringify(promptCandidate)
      : String(promptCandidate);

  const parsedComfy = safeJsonParse(promptStr);
  if (parsedComfy && typeof parsedComfy === 'object' && !Array.isArray(parsedComfy)) {
    const isComfyNodes = Object.values(parsedComfy).some(
      (v: any) => v && typeof v === 'object' && (v.class_type || v.inputs)
    );
    if (isComfyNodes) {
      exif.aiGenerator = 'ComfyUI';
      parseComfyUIGraph(parsedComfy, exif);
      return;
    }
  }

  // 3. Stable Diffusion WebUI (A1111) / Forge / SD.Next / Fooocus
  const textParams = meta.parameters || meta.UserComment || meta.Description || meta.comment || commentStr;
  if (typeof textParams === 'string' && (textParams.includes('Steps:') || textParams.includes('Sampler:') || textParams.includes('Negative prompt:'))) {
    if (software.includes('forge') || textParams.includes('Forge')) {
      exif.aiGenerator = 'SD WebUI Forge';
    } else if (software.includes('sd.next') || textParams.includes('SD.Next')) {
      exif.aiGenerator = 'SD.Next';
    } else if (software.includes('fooocus') || textParams.includes('Fooocus')) {
      exif.aiGenerator = 'Fooocus';
    } else {
      exif.aiGenerator = 'SD WebUI (A1111)';
    }

    if (textParams.includes('Negative prompt:')) {
      const parts = textParams.split('Negative prompt:');
      exif.aiPrompt = parts[0].trim();

      const subParts = parts[1].split(/Steps:\s*\d+/i);
      exif.aiNegativePrompt = subParts[0].trim();
    } else {
      const parts = textParams.split(/Steps:\s*\d+/i);
      exif.aiPrompt = parts[0].trim();
    }

    const stepsMatch = textParams.match(/Steps:\s*(\d+)/i);
    if (stepsMatch) exif.aiSteps = stepsMatch[1];
    const seedMatch = textParams.match(/Seed:\s*(\d+)/i);
    if (seedMatch) exif.aiSeed = seedMatch[1];
    const samplerMatch = textParams.match(/Sampler:\s*([^,]+)/i);
    if (samplerMatch) exif.aiSampler = samplerMatch[1].trim();
    const modelMatch = textParams.match(/Model:\s*([^,]+)/i);
    if (modelMatch) exif.aiModel = modelMatch[1].trim();
    const cfgMatch = textParams.match(/CFG scale:\s*([\d\.]+)/i);
    if (cfgMatch) exif.aiCfg = cfgMatch[1].trim();
    const clipSkipMatch = textParams.match(/Clip skip:\s*(\d+)/i);
    if (clipSkipMatch) exif.aiClipSkip = clipSkipMatch[1].trim();
    return;
  }

  // 4. Midjourney
  if (software.includes('midjourney') || (typeof textParams === 'string' && textParams.includes('--v ') && textParams.includes('--ar '))) {
    exif.aiGenerator = 'Midjourney';
    if (typeof textParams === 'string') {
      if (textParams.includes('--no ')) {
        const parts = textParams.split('--no ');
        exif.aiPrompt = parts[0].trim();
        const negParts = parts[1].split(/--\w+/);
        exif.aiNegativePrompt = negParts[0].trim();
      } else {
        const parts = textParams.split(/--\w+/);
        exif.aiPrompt = parts[0].trim();
      }
    }
    return;
  }

  // 5. Fallback for raw prompt string (ignoring JSON code)
  if (typeof textParams === 'string' && textParams.trim().length > 5 && !textParams.trim().startsWith('{')) {
    exif.aiPrompt = textParams.trim();
  }
}

/**
 * Parses EXIF data and AI generation prompts from an image file/URL.
 */
export async function parseImageExif(imageUrl: string, filePath?: string): Promise<ExifData | null> {
  try {
    const exif: ExifData = {};
    const collectedMeta: Record<string, any> = {};

    // 1. Direct PNG tEXt/iTXt chunk recovery
    // Prefer the main-process streaming reader (reads only text chunks, not the
    // whole file) so AI prompt indexing stays cheap on huge PNG libraries.
    try {
      if (filePath && window.electronAPI?.readImageMetadata) {
        const { textChunks } = await window.electronAPI.readImageMetadata(filePath);
        Object.assign(collectedMeta, textChunks);
      } else {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pngMeta = extractPngMetadata(arrayBuffer);
        Object.assign(collectedMeta, pngMeta);
      }
    } catch {}

    // 2. EXIF / IPTC / TIFF parser
    try {
      const rawExif = await exifr.parse(imageUrl, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        ihdr: true,
        userComment: true,
      });

      if (rawExif) {
        Object.assign(collectedMeta, rawExif);
        exif.make = rawExif.Make || rawExif.make;
        exif.model = rawExif.Model || rawExif.model;
        exif.lens = rawExif.LensModel || rawExif.lensModel || rawExif.Lens;
        exif.focalLength = rawExif.FocalLength ? `${rawExif.FocalLength}mm` : undefined;
        exif.fNumber = rawExif.FNumber ? `f/${rawExif.FNumber}` : undefined;
        exif.exposureTime = rawExif.ExposureTime
          ? (rawExif.ExposureTime < 1 ? `1/${Math.round(1 / rawExif.ExposureTime)}s` : `${rawExif.ExposureTime}s`)
          : undefined;
        exif.iso = rawExif.ISO || rawExif.PhotographicSensitivity;
        exif.dateTimeOriginal = rawExif.DateTimeOriginal ? new Date(rawExif.DateTimeOriginal).toLocaleString() : undefined;
        exif.width = rawExif.ExifImageWidth || rawExif.ImageWidth;
        exif.height = rawExif.ExifImageHeight || rawExif.ImageHeight;
        exif.colorSpace = rawExif.ColorSpace === 1 ? 'sRGB' : rawExif.ColorSpace ? 'Adobe RGB' : undefined;
        exif.software = rawExif.Software || rawExif.software;
        exif.latitude = rawExif.latitude;
        exif.longitude = rawExif.longitude;
      }
    } catch {}

    // 3. Detect generator and parse AI generation metadata
    detectAndParseAIMetadata(collectedMeta, exif);

    return Object.keys(exif).length > 0 ? exif : null;
  } catch (err) {
    return null;
  }
}

/**
 * Extracts dominant color palette and RGB histogram using Canvas 2D
 */
export async function analyzeImageColors(imageUrl: string): Promise<{
  palette: ColorPaletteItem[];
  histogram: { r: number[]; g: number[]; b: number[]; l: number[] };
} | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);

        // Downscale for fast analysis
        const sampleSize = 150;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imgData.data;
        const totalPixels = sampleSize * sampleSize;

        // Histograms (256 bins each)
        const rHist = new Array(256).fill(0);
        const gHist = new Array(256).fill(0);
        const bHist = new Array(256).fill(0);
        const lHist = new Array(256).fill(0);

        // Color quantization map (quantized 4-bit per channel)
        const colorBuckets = new Map<string, { count: number; r: number; g: number; b: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 128) continue; // skip transparent pixels

          // Update histograms
          rHist[r]++;
          gHist[g]++;
          bHist[b]++;
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          lHist[lum]++;

          // Quantize for palette
          const qr = (r >> 4) << 4;
          const qg = (g >> 4) << 4;
          const qb = (b >> 4) << 4;
          const key = `${qr},${qg},${qb}`;

          const existing = colorBuckets.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorBuckets.set(key, { count: 1, r: qr, g: qg, b: qb });
          }
        }

        // Sort colors by frequency
        const sortedColors = Array.from(colorBuckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const palette: ColorPaletteItem[] = sortedColors.map((c) => {
          const hex = `#${((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1).toUpperCase()}`;
          return {
            hex,
            rgb: [c.r, c.g, c.b],
            percent: Math.round((c.count / totalPixels) * 100),
          };
        });

        // Normalize histogram
        const maxFreq = Math.max(...rHist, ...gHist, ...bHist, ...lHist, 1);
        const normR = rHist.map((v) => v / maxFreq);
        const normG = gHist.map((v) => v / maxFreq);
        const normB = bHist.map((v) => v / maxFreq);
        const normL = lHist.map((v) => v / maxFreq);

        resolve({
          palette,
          histogram: { r: normR, g: normG, b: normB, l: normL },
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
