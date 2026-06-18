import { SpriteSheetTile } from '@/components/SpriteSheetTile';
import {
  GITHUB_RECIPE_SPRITE_CONFIG,
  GITHUB_RECIPE_SPRITE_URL,
  resolveGithubRecipeSprite,
} from '@/lib/github-recipe-sprites';

function firstGlyph(name: string): string {
  return [...name.trim()][0] ?? '?';
}

export function RecipeSprite({
  recipe,
  size = 'md',
  className,
}: {
  recipe: { id?: number | null; recipeId?: number | null; name?: string | null };
  size?: 'sm' | 'md';
  className?: string;
}) {
  const match = resolveGithubRecipeSprite(recipe);

  return (
    <SpriteSheetTile
      className={className}
      columns={GITHUB_RECIPE_SPRITE_CONFIG.columns}
      fallbackGlyph={firstGlyph(recipe.name ?? '')}
      rows={GITHUB_RECIPE_SPRITE_CONFIG.rows}
      size={size}
      spriteIndex={match?.spriteIndex ?? null}
      title={match?.name}
      url={GITHUB_RECIPE_SPRITE_URL}
    />
  );
}
