import { ImageItem } from '../types';
import { LayoutBox } from './justifiedLayout';

export interface MasonryResult {
  boxes: LayoutBox[];
  totalHeight: number;
}

/**
 * Calculates Pinterest-style multi-column Masonry layout preserving full aspect ratio.
 */
export function computeMasonryLayout(
  items: ImageItem[],
  containerWidth: number,
  targetColumnWidth: number = 280,
  gap: number = 8
): MasonryResult {
  if (!items || items.length === 0 || containerWidth <= 0) {
    return { boxes: [], totalHeight: 0 };
  }

  // Calculate number of columns
  const numColumns = Math.max(1, Math.floor((containerWidth + gap) / (targetColumnWidth + gap)));
  const totalGaps = (numColumns - 1) * gap;
  const columnWidth = Math.floor((containerWidth - totalGaps) / numColumns);

  // Column heights tracker
  const columnHeights = new Array(numColumns).fill(0);
  const boxes: LayoutBox[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aspect = item.aspectRatio > 0 ? item.aspectRatio : 1.333;
    const itemHeight = Math.round(columnWidth / aspect);

    // Find shortest column
    let minColIndex = 0;
    let minColHeight = columnHeights[0];
    for (let c = 1; c < numColumns; c++) {
      if (columnHeights[c] < minColHeight) {
        minColHeight = columnHeights[c];
        minColIndex = c;
      }
    }

    const left = minColIndex * (columnWidth + gap);
    const top = minColHeight;

    boxes.push({
      item,
      index: i,
      top,
      left,
      width: columnWidth,
      height: itemHeight,
    });

    columnHeights[minColIndex] += itemHeight + gap;
  }

  const totalHeight = Math.max(...columnHeights) - (items.length > 0 ? gap : 0);

  return {
    boxes,
    totalHeight: Math.max(0, totalHeight),
  };
}

/**
 * Calculates uniform Square Grid layout
 */
export function computeSquareGridLayout(
  items: ImageItem[],
  containerWidth: number,
  targetTileSize: number = 200,
  gap: number = 8
): MasonryResult {
  if (!items || items.length === 0 || containerWidth <= 0) {
    return { boxes: [], totalHeight: 0 };
  }

  const numColumns = Math.max(1, Math.floor((containerWidth + gap) / (targetTileSize + gap)));
  const totalGaps = (numColumns - 1) * gap;
  const tileSize = Math.floor((containerWidth - totalGaps) / numColumns);
  const boxes: LayoutBox[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = Math.floor(i / numColumns);
    const col = i % numColumns;

    const left = col * (tileSize + gap);
    const top = row * (tileSize + gap);

    boxes.push({
      item,
      index: i,
      top,
      left,
      width: tileSize,
      height: tileSize,
    });
  }

  const totalRows = Math.ceil(items.length / numColumns);
  const totalHeight = totalRows * tileSize + (totalRows - 1) * gap;

  return {
    boxes,
    totalHeight: Math.max(0, totalHeight),
  };
}
