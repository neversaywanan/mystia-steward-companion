import type { ReactNode } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';

import { TagBadge } from '@/components/TagBadge';
import { Button } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

type RecommendationMetaTone = 'cooker' | 'base' | 'extra' | 'neutral';

interface RecommendationFavoriteAction {
  active: boolean;
  disabled?: boolean;
  activeLabel: string;
  inactiveLabel: string;
  focusKey: string;
  onToggle: () => void;
}

interface RecommendationItemProps {
  index: number;
  title: ReactNode;
  titleSuffix?: ReactNode;
  badges?: ReactNode;
  summary?: ReactNode;
  inlineMeta?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  favorite?: RecommendationFavoriteAction;
  gamepadRowKey?: string;
  className?: string;
}

interface RecommendationTagBadgesProps {
  tags: readonly string[];
  matchedTags?: readonly string[];
  className?: string;
}

function RecommendationItem({
  index,
  title,
  titleSuffix,
  badges,
  summary,
  inlineMeta,
  meta,
  children,
  compact = false,
  favorite,
  gamepadRowKey,
  className,
}: RecommendationItemProps) {
  const favoriteLabel = favorite?.active ? favorite.activeLabel : favorite?.inactiveLabel;

  return (
    <div
      className={cn(
        compact ? 'rounded-md border border-border/80 p-1.5 text-xs' : 'rounded-md border border-border/80 p-2 text-sm',
        className,
      )}
      data-gamepad-focusable={favorite ? 'true' : undefined}
      data-gamepad-favorite-scope={favorite ? 'true' : undefined}
      data-gamepad-row={favorite ? 'true' : undefined}
      data-gamepad-row-key={favorite && gamepadRowKey ? gamepadRowKey : undefined}
      tabIndex={favorite ? 0 : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">#{index + 1}</span>
          <span className="font-medium">
            {title}
            {titleSuffix}
          </span>
          {badges}
          {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
          {inlineMeta}
        </div>
        {favorite && (
          <Button
            type="button"
            size="icon-xs"
            variant={favorite.active ? 'default' : 'outline'}
            disabled={favorite.disabled}
            aria-label={favoriteLabel}
            data-gamepad-favorite="true"
            data-gamepad-focus-key={favorite.focusKey}
            title={favoriteLabel}
            onClick={favorite.onToggle}
          >
            {favorite.active ? <IconStarFilled className="size-3" /> : <IconStar className="size-3" />}
          </Button>
        )}
      </div>
      {meta && <div className="mt-1 flex flex-wrap gap-1.5">{meta}</div>}
      {children}
    </div>
  );
}

function RecommendationMetaBadge({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  tone?: RecommendationMetaTone;
  className?: string;
}) {
  const toneClass = {
    cooker: 'steward-meta-cooker',
    base: 'steward-meta-base',
    extra: 'steward-meta-extra',
    neutral: 'steward-meta-neutral',
  }[tone];

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs', toneClass, className)}>
      <span className="shrink-0 font-medium">{label}</span>
      <span className="min-w-0 truncate" title={value}>{value}</span>
    </span>
  );
}

function RecommendationTagBadges({
  tags,
  matchedTags = [],
  className,
}: RecommendationTagBadgesProps) {
  if (tags.length === 0) return null;

  const matchedTagSet = new Set(matchedTags);

  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          variant={matchedTagSet.has(tag) ? 'matched' : 'default'}
        />
      ))}
    </div>
  );
}

export { RecommendationItem, RecommendationMetaBadge, RecommendationTagBadges };
export type {
  RecommendationFavoriteAction,
  RecommendationItemProps,
  RecommendationMetaTone,
  RecommendationTagBadgesProps,
};
