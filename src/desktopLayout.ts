export const DESKTOP_GRID = { cellWidth: 104, cellHeight: 104, iconWidth: 90, iconHeight: 90 };

export type DesktopBounds = { width: number; height: number };

export type DesktopGridMetrics = {
  width: number;
  height: number;
  maxX: number;
  maxY: number;
  columns: number;
  rows: number;
};

export function getDesktopBoundsSize(el?: Element | null): DesktopBounds {
  if (el instanceof HTMLElement) {
    const rect = el.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(el.clientWidth || rect.width)),
      height: Math.max(1, Math.floor(el.clientHeight || rect.height)),
    };
  }
  return { width: 1200, height: 700 };
}

/**
 * Uniform grid: cell (c,r) is at (c * cellWidth, r * cellHeight).
 * columns/rows = how many such origins keep the 90×90 icon fully inside bounds.
 */
export function getDesktopGridMetrics(bounds?: DesktopBounds): DesktopGridMetrics {
  const width = Math.max(1, Math.floor(bounds?.width ?? 1200));
  const height = Math.max(1, Math.floor(bounds?.height ?? 700));
  const maxX = Math.max(0, width - DESKTOP_GRID.iconWidth);
  const maxY = Math.max(0, height - DESKTOP_GRID.iconHeight);
  const columns = Math.max(1, Math.floor(maxX / DESKTOP_GRID.cellWidth) + 1);
  const rows = Math.max(1, Math.floor(maxY / DESKTOP_GRID.cellHeight) + 1);
  return { width, height, maxX, maxY, columns, rows };
}

export function getDesktopCellPosition(column: number, row: number, bounds?: DesktopBounds) {
  const metrics = getDesktopGridMetrics(bounds);
  const safeColumn = Math.min(metrics.columns - 1, Math.max(0, Math.floor(column)));
  const safeRow = Math.min(metrics.rows - 1, Math.max(0, Math.floor(row)));
  return {
    x: safeColumn * DESKTOP_GRID.cellWidth,
    y: safeRow * DESKTOP_GRID.cellHeight,
  };
}

export function getDesktopCellFromPosition(position: { x: number; y: number }, bounds?: DesktopBounds) {
  const metrics = getDesktopGridMetrics(bounds);
  // Clamp into the valid pixel range first, then map to the nearest cell index.
  const x = Math.max(0, Math.min(metrics.maxX, position.x));
  const y = Math.max(0, Math.min(metrics.maxY, position.y));
  const column = Math.min(metrics.columns - 1, Math.max(0, Math.round(x / DESKTOP_GRID.cellWidth)));
  const row = Math.min(metrics.rows - 1, Math.max(0, Math.round(y / DESKTOP_GRID.cellHeight)));
  return { column, row };
}

export function getDesktopGridPosition(index: number, bounds?: DesktopBounds) {
  const { columns } = getDesktopGridMetrics(bounds);
  return getDesktopCellPosition(index % columns, Math.floor(index / columns), bounds);
}

export function clampDesktopIconPosition(position: { x: number; y: number }, bounds?: DesktopBounds) {
  const { maxX, maxY } = getDesktopGridMetrics(bounds);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
}

export function snapDesktopIconPosition(position: { x: number; y: number }, bounds?: DesktopBounds) {
  const cell = getDesktopCellFromPosition(position, bounds);
  return getDesktopCellPosition(cell.column, cell.row, bounds);
}

export function getDesktopGridKey(position: { x: number; y: number }, bounds?: DesktopBounds) {
  const cell = getDesktopCellFromPosition(position, bounds);
  return `${cell.column}:${cell.row}`;
}

export function findNearestAvailableGridPosition(
  position: { x: number; y: number },
  occupiedKeys: Set<string>,
  bounds?: DesktopBounds,
) {
  const metrics = getDesktopGridMetrics(bounds);
  const desired = getDesktopCellFromPosition(position, bounds);
  let best: { column: number; row: number; distance: number } | null = null;

  for (let row = 0; row < metrics.rows; row += 1) {
    for (let column = 0; column < metrics.columns; column += 1) {
      const key = `${column}:${row}`;
      if (occupiedKeys.has(key)) continue;
      const distance = Math.abs(column - desired.column) + Math.abs(row - desired.row);
      if (!best || distance < best.distance || (distance === best.distance && (row < best.row || (row === best.row && column < best.column)))) {
        best = { column, row, distance };
      }
    }
  }

  if (!best) return getDesktopCellPosition(desired.column, desired.row, bounds);
  return getDesktopCellPosition(best.column, best.row, bounds);
}

/** Assign unique grid cells to every item (stable order: top-to-bottom, left-to-right by current pos). */
export function layoutItemsOnDesktopGrid(
  itemIds: string[],
  positions: Record<string, { x: number; y: number } | undefined>,
  bounds?: DesktopBounds,
) {
  const metrics = getDesktopGridMetrics(bounds);
  const ordered = [...itemIds].sort((a, b) => {
    const aIndex = itemIds.indexOf(a);
    const bIndex = itemIds.indexOf(b);
    const aPos = positions[a] ?? getDesktopGridPosition(aIndex, bounds);
    const bPos = positions[b] ?? getDesktopGridPosition(bIndex, bounds);
    return aPos.y - bPos.y || aPos.x - bPos.x || aIndex - bIndex;
  });

  const occupiedKeys = new Set<string>();
  const next: Record<string, { x: number; y: number }> = {};

  ordered.forEach((id) => {
    const index = Math.max(0, itemIds.indexOf(id));
    const desired = positions[id] ?? getDesktopGridPosition(index, bounds);
    const placed = findNearestAvailableGridPosition(desired, occupiedKeys, bounds);
    occupiedKeys.add(getDesktopGridKey(placed, bounds));
    next[id] = placed;
  });

  // If the grid is full, remaining items still get a clamped snap (may stack only when truly full).
  void metrics;
  return next;
}
