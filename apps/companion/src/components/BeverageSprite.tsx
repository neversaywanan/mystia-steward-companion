import { SpriteSheetTile } from '@/components/SpriteSheetTile';
import {
  GITHUB_BEVERAGE_SPRITE_CONFIG,
  GITHUB_BEVERAGE_SPRITE_URL,
  resolveGithubBeverageSprite,
} from '@/lib/github-beverage-sprites';

function firstGlyph(name: string): string {
  return [...name.trim()][0] ?? '?';
}

export function BeverageSprite({
  beverage,
  size = 'md',
  className,
}: {
  beverage: { id?: number | null; name?: string | null };
  size?: 'sm' | 'md';
  className?: string;
}) {
  const match = resolveGithubBeverageSprite(beverage);

  return (
    <SpriteSheetTile
      className={className}
      columns={GITHUB_BEVERAGE_SPRITE_CONFIG.columns}
      fallbackGlyph={firstGlyph(beverage.name ?? '')}
      rows={GITHUB_BEVERAGE_SPRITE_CONFIG.rows}
      size={size}
      spriteIndex={match?.spriteIndex ?? null}
      title={match?.name}
      url={GITHUB_BEVERAGE_SPRITE_URL}
    />
  );
}
