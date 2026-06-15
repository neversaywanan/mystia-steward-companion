import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-kit';
import { composeClassNames } from '@/components/ui/style';

export type TagPillTone =
  | 'positive'
  | 'negative'
  | 'added'
  | 'suppressed'
  | 'match'
  | 'neutral';

const tagToneClass: Record<TagPillTone, string> = {
  positive: 'steward-tag-preferred',
  negative: 'steward-tag-disliked',
  added: 'steward-tag-extra',
  suppressed: 'steward-tag-cancelled',
  match: 'steward-tag-matched',
  neutral: 'steward-tag-default',
};

export function TagPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: TagPillTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={composeClassNames('text-xs font-normal', tagToneClass[tone], className)}
    >
      {children}
    </Badge>
  );
}

export function TagPillGroup({
  tags,
  tone = 'neutral',
  matchedTags = [],
  matchedTone = 'match',
  className,
}: {
  tags: readonly string[];
  tone?: TagPillTone;
  matchedTags?: readonly string[];
  matchedTone?: TagPillTone;
  className?: string;
}) {
  if (tags.length === 0) return null;

  const matched = new Set(matchedTags);

  return (
    <div className={composeClassNames('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <TagPill key={tag} tone={matched.has(tag) ? matchedTone : tone}>
          {tag}
        </TagPill>
      ))}
    </div>
  );
}
