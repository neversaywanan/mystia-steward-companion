/** 普客匹配分颜色：0灰、1~2橙、3+粉 */
function getScoreColor(score: number) {
  if (score >= 3) return 'steward-score-high';
  if (score >= 1) return 'steward-score-mid';
  return 'steward-score-low';
}

export function CustomerScoreBadges({
  scores,
}: {
  scores: Array<{ name: string; score: number }>;
}) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {scores.map((s) => (
        <span
          key={s.name}
          className={`text-[10px] px-1.5 py-0.5 rounded ${getScoreColor(s.score)}`}
        >
          {s.name}:{s.score}
        </span>
      ))}
    </span>
  );
}
