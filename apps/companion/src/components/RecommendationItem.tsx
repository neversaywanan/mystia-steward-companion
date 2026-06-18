import type { ReactNode } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';

import { TagPillGroup } from '@/components/recommendation/TagPillGroup';
import { Button } from '@/components/ui-kit';
import { composeClassNames } from '@/components/ui/style';

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
  leading?: ReactNode;
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

interface RecommendationTagPillsProps {
  tags: readonly string[];
  matchedTags?: readonly string[];
  className?: string;
}

function RecommendationItem({
  index,
  leading,
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
  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">#{index + 1}</span>
          <span className="text-base font-bold text-foreground">
            {title}
            {titleSuffix}
          </span>
          {badges}
          {summary && <span className="text-sm font-mono text-muted-foreground ml-1">{summary}</span>}
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
      {meta && <div className="mt-1.5">{meta}</div>}
      {children}
    </>
  );

  return (
    <div
      className={composeClassNames(
        compact ? 'rounded-md border border-border/80 p-1.5 text-xs' : 'rounded-md border border-border/80 p-2 text-sm',
        className,
      )}
      data-gamepad-focusable={favorite ? 'true' : undefined}
      data-gamepad-favorite-scope={favorite ? 'true' : undefined}
      data-gamepad-row={favorite ? 'true' : undefined}
      data-gamepad-row-key={favorite && gamepadRowKey ? gamepadRowKey : undefined}
      tabIndex={favorite ? 0 : undefined}
    >
      {leading ? (
        <div className="flex items-start gap-2">
          {leading}
          <div className="min-w-0 flex-1">{content}</div>
        </div>
      ) : content}
    </div>
  );
}



function RecommendationTagPills({
  tags,
  matchedTags = [],
  className,
}: RecommendationTagPillsProps) {
  return <TagPillGroup tags={tags} matchedTags={matchedTags} className={composeClassNames('mt-1', className)} />;
}

export { RecommendationItem, RecommendationTagPills };
export type {
  RecommendationFavoriteAction,
  RecommendationItemProps,
  RecommendationMetaTone,
  RecommendationTagPillsProps,
};
