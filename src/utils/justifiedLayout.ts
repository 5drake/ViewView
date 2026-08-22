import { ImageItem } from '../types';

export interface LayoutBox {
  item: ImageItem;
  index: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface JustifiedResult {
  boxes: LayoutBox[];
  totalHeight: number;
}

/**
 * Calculates a zero-crop, zero-padding justified (Flickr/Google Photos style) layout.
 * Every image preserves its exact original aspect ratio and rows are packed tightly.
 */
export function computeJustifiedLayout(
  items: ImageItem[],
  containerWidth: number,
  targetRowHeight: number = 240,
  gap: number = 8,
  maxRowHeightScale: number = 1.8
): JustifiedResult {
  if (!items || items.length === 0 || containerWidth <= 0) {
    return { boxes: [], totalHeight: 0 };
  }

  const boxes: LayoutBox[] = [];
  let currentRow: Array<{ item: ImageItem; index: number; aspect: number }> = [];
  let currentAspectRatioSum = 0;
  let currentTop = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Fallback aspect ratio if 0 or invalid
    const aspect = item.aspectRatio > 0 ? item.aspectRatio : (item.width && item.height ? item.width / item.height : 1.333);
    
    currentRow.push({ item, index: i, aspect });
    currentAspectRatioSum += aspect;

    // Total horizontal gaps needed for current items in row
    const rowGaps = (currentRow.length - 1) * gap;
    const availableWidth = containerWidth - rowGaps;
    
    // Predicted row height if we close the row now
    const predictedHeight = availableWidth / currentAspectRatioSum;

    // If adding this image brings the row height near or below targetRowHeight, close the row!
    if (predictedHeight <= targetRowHeight || i === items.length - 1) {
      const isLastItem = i === items.length - 1;
      
      // If it's the last incomplete row and the height would be stretched too much
      let finalRowHeight = predictedHeight;
      let isStretchingTooMuch = predictedHeight > targetRowHeight * maxRowHeightScale;

      if (isLastItem && isStretchingTooMuch) {
        // Keep targetRowHeight for last row so items don't look giant
        finalRowHeight = targetRowHeight;
      }

      // Minimum visible height: an extreme panorama alone in its row computes
      // to a sub-pixel height that rounds to 0px and renders invisibly. With
      // the clamp such a row overflows horizontally instead (clipped by the
      // container) but at least stays visible.
      const MIN_ROW_HEIGHT = 40;
      if (finalRowHeight < MIN_ROW_HEIGHT) {
        finalRowHeight = MIN_ROW_HEIGHT;
      }

      // Lay out each item in the closed row
      let currentLeft = 0;
      for (let j = 0; j < currentRow.length; j++) {
        const rowItem = currentRow[j];
        let itemWidth: number;

        if (isLastItem && isStretchingTooMuch) {
          itemWidth = Math.round(finalRowHeight * rowItem.aspect);
        } else if (j === currentRow.length - 1) {
          // Last item in row takes the remaining exact pixel width to prevent subpixel rounding gaps
          itemWidth = Math.max(10, containerWidth - currentLeft);
        } else {
          itemWidth = Math.round(finalRowHeight * rowItem.aspect);
        }

        boxes.push({
          item: rowItem.item,
          index: rowItem.index,
          top: Math.round(currentTop),
          left: Math.round(currentLeft),
          width: itemWidth,
          height: Math.round(finalRowHeight),
        });

        currentLeft += itemWidth + gap;
      }

      currentTop += finalRowHeight + gap;
      currentRow = [];
      currentAspectRatioSum = 0;
    }
  }

  return {
    boxes,
    totalHeight: Math.max(0, currentTop - (boxes.length > 0 ? gap : 0)),
  };
}
