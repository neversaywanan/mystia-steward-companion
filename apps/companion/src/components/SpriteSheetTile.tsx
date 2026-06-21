import { useState } from 'react';

import { composeClassNames } from '@/components/ui/style';
import { buildSpriteSheetLayout } from '@/lib/sprite-sheet';

type SpriteTileSize = 'sm' | 'md' | 'lg';

function renderSizePx(size: SpriteTileSize) {
  if (size === 'sm') return 32;
  if (size === 'lg') return 48;
  return 40;
}

export function SpriteSheetTile({
  className,
  columns,
  fallbackGlyph,
  rows,
  size = 'md',
  spriteIndex,
  title,
  url,
}: {
  className?: string;
  columns: number;
  fallbackGlyph: string;
  rows: number;
  size?: SpriteTileSize;
  spriteIndex: number | null;
  title?: string;
  url?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const sizeClass = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : 'size-10';
  const layout = spriteIndex === null
    ? null
    : buildSpriteSheetLayout({ columns, rows, spriteIndex, tileSize: renderSizePx(size) });
  if (!layout || !url || failedUrl === url) {
    return (
      <div
        className={composeClassNames(
          'flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/70 font-semibold text-muted-foreground',
          sizeClass,
          className,
        )}
        aria-hidden="true"
      >
        {fallbackGlyph}
      </div>
    );
  }

  return (
    <div
      className={composeClassNames(
        'relative shrink-0 overflow-hidden rounded-md border border-border/80 bg-card shadow-sm',
        sizeClass,
        className,
      )}
      aria-hidden="true"
      title={title}
    >
      <img
        alt=""
        className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
        draggable={false}
        src={url ?? ''}
        style={{ ...layout, imageRendering: 'pixelated' }}
        onError={() => setFailedUrl(url ?? null)}
      />
    </div>
  );
}
