import { Badge } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

type TagVariant =
  | 'preferred'
  | 'disliked'
  | 'extra'
  | 'cancelled'
  | 'matched'
  | 'default';

const variantStyles: Record<TagVariant, string> = {
  preferred: 'steward-tag-preferred',
  disliked: 'steward-tag-disliked',
  cancelled: 'steward-tag-cancelled',
  extra: 'steward-tag-extra',
  matched: 'steward-tag-matched',
  default: 'steward-tag-default',
};

interface TagBadgeProps {
  tag: string;
  variant?: TagVariant;
  className?: string;
}

export function TagBadge({ tag, variant = 'default', className }: TagBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-normal', variantStyles[variant], className)}
    >
      {tag}
    </Badge>
  );
}
