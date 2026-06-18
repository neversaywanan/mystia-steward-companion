interface SpriteSheetLayoutInput {
  columns: number;
  rows: number;
  spriteIndex: number;
  tileSize: number;
}

export function buildSpriteSheetLayout({
  columns,
  rows,
  spriteIndex,
  tileSize,
}: SpriteSheetLayoutInput) {
  const cellCount = columns * rows;
  if (
    !Number.isInteger(columns)
    || !Number.isInteger(rows)
    || !Number.isInteger(spriteIndex)
    || columns <= 0
    || rows <= 0
    || tileSize <= 0
    || spriteIndex < 0
    || spriteIndex >= cellCount
  ) {
    return null;
  }

  const column = spriteIndex % columns;
  const row = Math.floor(spriteIndex / columns);
  return {
    height: tileSize * rows,
    transform: `translate(${-column * tileSize}px, ${-row * tileSize}px)`,
    width: tileSize * columns,
  };
}
