import { Badge } from '@/components/ui-kit';

interface CustomerCoverageEntry {
  customerName: string;
  matchedTagCount: number;
}

function getCoverageClassName(matchedTagCount: number): string {
  if (matchedTagCount >= 3) return 'steward-score-high';
  if (matchedTagCount >= 1) return 'steward-score-mid';
  return 'steward-score-low';
}

export function CustomerCoverageBadges({
  coverage,
}: {
  coverage: readonly CustomerCoverageEntry[];
}) {
  if (coverage.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {coverage.map((entry) => (
        <Badge
          key={entry.customerName}
          variant="outline"
          className={getCoverageClassName(entry.matchedTagCount)}
        >
          {entry.customerName}:{entry.matchedTagCount}
        </Badge>
      ))}
    </span>
  );
}

export type { CustomerCoverageEntry };
