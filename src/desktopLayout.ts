export const DESKTOP_GRID = { cellWidth: 104, cellHeight: 104, iconWidth: 90, iconHeight: 90 };

export function getDesktopGridPosition(index: number, bounds?: { width: number; height: number }) {
  const columns = Math.max(1, Math.floor(((bounds?.width ?? 900) + 14) / DESKTOP_GRID.cellWidth));
  return {
    x: (index % columns) * DESKTOP_GRID.cellWidth,
    y: Math.floor(index / columns) * DESKTOP_GRID.cellHeight,
  };
}

export function clampDesktopIconPosition(position: { x: number; y: number }, bounds?: { width: number; height: number }) {
  return {
    x: Math.max(0, Math.min((bounds?.width ?? 1200) - DESKTOP_GRID.iconWidth, position.x)),
    y: Math.max(0, Math.min((bounds?.height ?? 700) - DESKTOP_GRID.iconHeight, position.y)),
  };
}

export function snapDesktopIconPosition(position: { x: number; y: number }, bounds?: { width: number; height: number }) {
  return clampDesktopIconPosition({
    x: Math.round(position.x / DESKTOP_GRID.cellWidth) * DESKTOP_GRID.cellWidth,
    y: Math.round(position.y / DESKTOP_GRID.cellHeight) * DESKTOP_GRID.cellHeight,
  }, bounds);
}

export function getDesktopGridKey(position: { x: number; y: number }) {
  return `${Math.round(position.x / DESKTOP_GRID.cellWidth)}:${Math.round(position.y / DESKTOP_GRID.cellHeight)}`;
}

export function findNearestAvailableGridPosition(position: { x: number; y: number }, occupiedKeys: Set<string>, bounds?: { width: number; height: number }) {
  const snapped = snapDesktopIconPosition(position, bounds);
  const desiredColumn = Math.round(snapped.x / DESKTOP_GRID.cellWidth);
  const desiredRow = Math.round(snapped.y / DESKTOP_GRID.cellHeight);
  const columns = Math.max(1, Math.floor(((bounds?.width ?? 1200) - DESKTOP_GRID.iconWidth) / DESKTOP_GRID.cellWidth) + 1);
  const rows = Math.max(1, Math.floor(((bounds?.height ?? 700) - DESKTOP_GRID.iconHeight) / DESKTOP_GRID.cellHeight) + 1);
  const cells: { column: number; row: number; distance: number }[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({ column, row, distance: Math.abs(column - desiredColumn) + Math.abs(row - desiredRow) });
    }
  }

  cells.sort((a, b) => a.distance - b.distance || a.row - b.row || a.column - b.column);
  const cell = cells.find((item) => !occupiedKeys.has(`${item.column}:${item.row}`));
  if (!cell) return snapped;
  return { x: cell.column * DESKTOP_GRID.cellWidth, y: cell.row * DESKTOP_GRID.cellHeight };
}
