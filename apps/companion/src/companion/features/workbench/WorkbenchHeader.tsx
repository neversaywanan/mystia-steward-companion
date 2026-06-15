import { IconRefresh } from '@tabler/icons-react';
import { Badge, Button, Input, StatusCard, SwitchField } from '@/components/ui-kit';
import { formatRetryDelay, formatTime } from '@/companion/formatters';
import { CONNECTION_RETRY_DELAYS_MS } from '@/companion/hooks/useCompanionConnection';
import type { LocalApiSnapshot, NightBusinessContext } from '@/companion/types';

const STATUS_GRID_CLASS = 'grid grid-cols-3 gap-3';

interface WorkbenchHeaderProps {
  endpointDraft: string;
  onEndpointDraftChange: (value: string) => void;
  onApplyEndpointConnection: () => void;
  onPauseConnection: () => void;
  onRefresh: () => void;
  apiToken: string;
  connectionPaused: boolean;
  connectionFailureCount: number;
  error: string;
  lastConnectedAt: Date | null;
  loading: boolean;
  normalizedEndpoint: string;
  mousePassthroughEnabled: boolean;
  night: NightBusinessContext | null;
  snapshot: LocalApiSnapshot | null;
}

export function WorkbenchHeader({
  endpointDraft,
  onEndpointDraftChange,
  onApplyEndpointConnection,
  onPauseConnection,
  onRefresh,
  apiToken,
  connectionPaused,
  connectionFailureCount,
  error,
  lastConnectedAt,
  loading,
  normalizedEndpoint,
  mousePassthroughEnabled,
  night,
  snapshot,
}: WorkbenchHeaderProps) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
            <h1 className="text-[1.7rem] font-bold leading-tight text-foreground">Mod 工作台</h1>
            <span className="text-sm leading-none text-muted-foreground">
              {snapshot ? `mystia-steward-companion ${snapshot.pluginVersion}` : '等待本地 API 响应'}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
            <Input
              value={endpointDraft}
              onChange={(event) => onEndpointDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onApplyEndpointConnection();
              }}
              spellCheck={false}
              className="w-[18rem] max-w-[48vw]"
              inputClassName="font-mono"
            />
            <SwitchField
              label="连接"
              checked={!connectionPaused}
              onCheckedChange={(checked) => {
                if (checked) {
                  onApplyEndpointConnection();
                } else {
                  onPauseConnection();
                }
              }}
              className="h-8 rounded-sm steward-muted-surface-35 px-2.5"
            />
            <Button size="sm" onClick={onRefresh} disabled={loading || !apiToken}>
              <IconRefresh className={loading ? 'size-4 animate-spin' : 'size-4'} />
              刷新
            </Button>
          </div>
        </div>
        {mousePassthroughEnabled && (
          <Badge variant="secondary">
            鼠标穿透中 · F10 解除
          </Badge>
        )}
      </div>

      <div className={STATUS_GRID_CLASS}>
        <StatusCard
          label="连接状态"
          value={!apiToken ? '未授权' : connectionPaused ? '已停止' : error ? '重试中' : snapshot ? '已连接' : '连接中'}
          detail={!apiToken
            ? '未收到游戏启动参数 Token'
            : connectionPaused
              ? '点击连接恢复自动重连'
              : error
                ? `${error}；${formatRetryDelay(connectionFailureCount, CONNECTION_RETRY_DELAYS_MS)} 后重试`
                : lastConnectedAt
                  ? `最近响应 ${formatTime(lastConnectedAt)}`
                  : normalizedEndpoint}
          tone={!apiToken || connectionPaused || error ? 'bad' : snapshot ? 'good' : 'neutral'}
        />
        <StatusCard
          label="游戏运行态"
          value={snapshot?.runtimeLoaded ? '已加载' : '未加载'}
          detail={snapshot?.activeSceneName || snapshot?.status || '暂无快照'}
          tone={snapshot?.runtimeLoaded ? 'good' : 'neutral'}
        />
        <StatusCard
          label="经营数据"
          value={`${night?.activeRareGuests.length ?? 0} 稀客 / ${night?.orders.length ?? 0} 点单`}
          detail={night?.place || night?.placeLabel || '无经营场景'}
          tone={(night?.orders.length ?? 0) > 0 ? 'good' : 'neutral'}
        />
      </div>
    </>
  );
}
