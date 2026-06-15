import { useCallback, useEffect, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { Button, InfoLine, ListPanel, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-kit';
import { readLogSettings, writeLogSettings } from '@/companion/api';
import {
  BEVERAGE_SORT_OPTIONS,
  MAX_AUTO_ROLLBACKS_LIMIT,
  MAX_AUTO_STEP_RETRIES_LIMIT,
  MAX_AUTO_WAIT_SECONDS,
  MAX_NORMAL_AUTO_ORDER_CONCURRENCY,
  MAX_RARE_AUTO_ORDER_CONCURRENCY,
  MIN_AUTO_ORDER_CONCURRENCY,
  MIN_AUTO_ROLLBACKS,
  MIN_AUTO_STEP_RETRIES,
  MIN_AUTO_WAIT_SECONDS,
  RECIPE_SORT_OPTIONS,
  buildDefaultSortRules,
  type CompanionPreferences,
} from '@/companion/preferences';
import type { LocalApiLogSettings, SettingsTab } from '@/companion/types';
import type { ThemeMode } from '@/lib/theme';
import {
  AutomationSliderField,
  BackgroundOpacitySlider,
  ContentOpacitySlider,
  FocusSwitchCooldownInput,
  SettingSegmentedControl,
  SortRulesControl,
  SwitchControl,
} from '@/companion/pages/shared';
import { DENSE_TWO_COLUMN_GRID, INNER_TAB_TRIGGER_CLASS } from '@/companion/pages/shared-constants';

export function ModSettingsPanel({
  endpoint,
  apiToken,
  preferences,
  themeMode,
  serviceFocusCompact,
  onPreferenceChange,
  onThemeModeChange,
  onServiceFocusCompactChange,
}: {
  endpoint: string;
  apiToken: string;
  preferences: CompanionPreferences;
  themeMode: ThemeMode;
  serviceFocusCompact: boolean;
  onPreferenceChange: (next: Partial<CompanionPreferences>) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onServiceFocusCompactChange: (value: boolean) => void;
}) {
  const [logSettings, setLogSettings] = useState<LocalApiLogSettings | null>(null);
  const [consoleBusy, setConsoleBusy] = useState(false);
  const [consoleError, setConsoleError] = useState('');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('window');

  const refreshConsoleSettings = useCallback(async () => {
    if (!apiToken) {
      setLogSettings(null);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 2800);
    try {
      const nextSettings = await readLogSettings(endpoint, apiToken, abortController.signal);
      setLogSettings(nextSettings);
      setConsoleError('');
    } catch (err) {
      setConsoleError(err instanceof Error ? err.message : String(err));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [apiToken, endpoint]);

  const setNativeConsoleEnabled = useCallback(async (nativeConsole: boolean) => {
    if (!apiToken) return;

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 2800);
    setConsoleBusy(true);
    try {
      const nextSettings = await writeLogSettings(
        endpoint,
        apiToken,
        { nativeConsole },
        abortController.signal,
      );
      setLogSettings(nextSettings);
      setConsoleError('');
    } catch (err) {
      setConsoleError(err instanceof Error ? err.message : String(err));
    } finally {
      window.clearTimeout(timeoutId);
      setConsoleBusy(false);
    }
  }, [apiToken, endpoint]);

  useEffect(() => {
    if (!preferences.showDebugDetails) return;
    refreshConsoleSettings();
  }, [preferences.showDebugDetails, refreshConsoleSettings]);

  useEffect(() => {
    if (!preferences.showDebugDetails && settingsTab === 'debug') {
      setSettingsTab('window');
    }
  }, [preferences.showDebugDetails, settingsTab]);

  return (
    <Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as SettingsTab)} className="space-y-4">
      <TabsList className={preferences.showDebugDetails ? 'grid h-9 w-full grid-cols-5' : 'grid h-9 w-full grid-cols-4'}>
        <TabsTrigger value="window" className={INNER_TAB_TRIGGER_CLASS} data-gamepad-clickable="true">
          窗口
        </TabsTrigger>
        <TabsTrigger value="recommendation" className={INNER_TAB_TRIGGER_CLASS} data-gamepad-clickable="true">
          推荐
        </TabsTrigger>
        <TabsTrigger value="sorting" className={INNER_TAB_TRIGGER_CLASS} data-gamepad-clickable="true">
          排序
        </TabsTrigger>
        <TabsTrigger value="automation" className={INNER_TAB_TRIGGER_CLASS} data-gamepad-clickable="true">
          自动化
        </TabsTrigger>
        {preferences.showDebugDetails && (
          <TabsTrigger value="debug" className={INNER_TAB_TRIGGER_CLASS} data-gamepad-clickable="true">
            调试
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="window" className="space-y-4">
        <div className={DENSE_TWO_COLUMN_GRID}>
          <ListPanel title="窗口">
            <div className="space-y-4">
              <BackgroundOpacitySlider
                value={preferences.backgroundOpacity}
                onChange={(backgroundOpacity) => onPreferenceChange({ backgroundOpacity })}
              />
              <ContentOpacitySlider
                value={preferences.contentOpacity}
                onChange={(contentOpacity) => onPreferenceChange({ contentOpacity })}
              />
              <SettingSegmentedControl
                label="焦点切换"
                value={preferences.focusSwitchBehavior}
                options={[
                  { value: 'hide', label: '隐藏窗口' },
                  { value: 'keep-visible', label: '保持悬浮' },
                ]}
                onChange={(focusSwitchBehavior) => onPreferenceChange({ focusSwitchBehavior })}
              />
              <FocusSwitchCooldownInput
                value={preferences.focusSwitchCooldownMs}
                onChange={(focusSwitchCooldownMs) => onPreferenceChange({ focusSwitchCooldownMs })}
              />
              <SwitchControl
                label="始终置顶"
                checked={preferences.alwaysOnTop}
                onCheckedChange={(alwaysOnTop) => onPreferenceChange({ alwaysOnTop })}
              />
              <SwitchControl
                label="鼠标穿透锁定"
                checked={preferences.mousePassthroughEnabled}
                onCheckedChange={(mousePassthroughEnabled) => onPreferenceChange({ mousePassthroughEnabled })}
              />
              <div className="text-xs text-muted-foreground">
                开启后伴随窗口会忽略鼠标点击，点击会落到下方游戏或其他窗口；按 F10、F8/RS Click 或托盘菜单可恢复操作。
              </div>
            </div>
          </ListPanel>

          <ListPanel title="显示">
            <div className="space-y-4">
              <SettingSegmentedControl
                label="主题"
                value={themeMode}
                options={[
                  { value: 'system', label: '跟随系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                ]}
                onChange={onThemeModeChange}
              />
              <SwitchControl
                label="手柄导航"
                checked={preferences.gamepadNavigationEnabled}
                onCheckedChange={(gamepadNavigationEnabled) => onPreferenceChange({ gamepadNavigationEnabled })}
              />
              <div className="text-xs text-muted-foreground">
                关闭手柄导航只影响伴随窗口内的手柄操作；F8 仍可在伴随窗口聚焦时切回游戏。
              </div>
              <SwitchControl
                label="显示调试信息"
                checked={preferences.showDebugDetails}
                onCheckedChange={(showDebugDetails) => onPreferenceChange({ showDebugDetails })}
              />
              <div className="text-xs text-muted-foreground">
                开启后显示日志页、扫描状态、运行时来源、性能耗时和订单内部来源；普通使用建议保持关闭。
              </div>
            </div>
          </ListPanel>

          <ListPanel title="稀客专注模式">
            <div className="space-y-4">
              <SwitchControl
                label="默认精简模式"
                checked={serviceFocusCompact}
                onCheckedChange={onServiceFocusCompactChange}
              />
              <div className="text-xs text-muted-foreground">
                料理和酒水显示数量在进入专注模式后直接调整，设置会自动记住。
              </div>
            </div>
          </ListPanel>
        </div>
      </TabsContent>

      <TabsContent value="recommendation" className="space-y-4">
        <ListPanel title="推荐">
          <div className="space-y-4">
            <SwitchControl
              label="排除缺失厨具"
              checked={preferences.filterMissingCookers}
              onCheckedChange={(filterMissingCookers) => onPreferenceChange({ filterMissingCookers })}
            />
            <div className="text-xs text-muted-foreground">
              进入经营场景后，若读取到已摆放厨具，推荐列表会隐藏当前场景无法制作的料理。
            </div>
            <SwitchControl
              label="优先任务料理"
              checked={preferences.prioritizeMissionRecipes}
              onCheckedChange={(prioritizeMissionRecipes) => onPreferenceChange({ prioritizeMissionRecipes })}
            />
            <div className="text-xs text-muted-foreground">
              当前稀客存在经营投喂任务时，把任务指定料理优先放到推荐第一位；只影响排序，不会自动完成任务。
            </div>
            <SettingSegmentedControl
              label="经营中订单排序"
              value={preferences.serviceOrderSortMode}
              options={[
                { value: 'ordered', label: '点单顺序' },
                { value: 'guest', label: '稀客分组' },
              ]}
              onChange={(serviceOrderSortMode) => onPreferenceChange({ serviceOrderSortMode })}
            />
            <SwitchControl
              label="游戏界面置顶推荐（实验性）"
              checked={preferences.gameUiPinningEnabled}
              onCheckedChange={(gameUiPinningEnabled) => onPreferenceChange({ gameUiPinningEnabled })}
            />
            <div className="text-xs text-muted-foreground">
              打开料理或酒水选择界面时，尝试把当前第一笔订单的推荐材料、料理和酒水排到前面；失败时只记录诊断，不修改库存。
            </div>
            <SwitchControl
              label="目标厨具高亮（实验性）"
              checked={preferences.cookerHighlightEnabled}
              onCheckedChange={(cookerHighlightEnabled) => onPreferenceChange({ cookerHighlightEnabled })}
            />
            <div className="text-xs text-muted-foreground">
              经营中有推荐目标厨具时，尝试让对应已摆放厨具显示黄色脉冲高亮；只改变可见提示，不自动操作厨具。
            </div>
          </div>
        </ListPanel>
      </TabsContent>

      <TabsContent value="sorting" className="space-y-4">
        <div className={DENSE_TWO_COLUMN_GRID}>
          <ListPanel title="料理排序">
            <SortRulesControl
              rules={preferences.recipeSortRules}
              options={RECIPE_SORT_OPTIONS}
              onChange={(recipeSortRules) => onPreferenceChange({ recipeSortRules })}
              onReset={() => onPreferenceChange({ recipeSortRules: buildDefaultSortRules(RECIPE_SORT_OPTIONS) })}
            />
          </ListPanel>

          <ListPanel title="酒水排序">
            <SortRulesControl
              rules={preferences.beverageSortRules}
              options={BEVERAGE_SORT_OPTIONS}
              onChange={(beverageSortRules) => onPreferenceChange({ beverageSortRules })}
              onReset={() => onPreferenceChange({ beverageSortRules: buildDefaultSortRules(BEVERAGE_SORT_OPTIONS) })}
            />
          </ListPanel>
        </div>
      </TabsContent>

      <TabsContent value="automation" className="space-y-4">
        <ListPanel title="自动化">
          <div className="space-y-4">
            <SwitchControl
              label="启用自动化（实验性）"
              checked={preferences.automationEnabled}
              onCheckedChange={(automationEnabled) => onPreferenceChange({ automationEnabled })}
            />
            <div className="text-xs text-muted-foreground">
              关闭时不会显示或执行任何自动化动作；开启后可在“经营中”页面配置具体子功能。
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <AutomationSliderField
                label="稀客并发"
                value={preferences.autoRareConcurrency}
                min={MIN_AUTO_ORDER_CONCURRENCY}
                max={MAX_RARE_AUTO_ORDER_CONCURRENCY}
                onChange={(autoRareConcurrency) => onPreferenceChange({ autoRareConcurrency })}
              />
              <AutomationSliderField
                label="普客并发"
                value={preferences.autoNormalConcurrency}
                min={MIN_AUTO_ORDER_CONCURRENCY}
                max={MAX_NORMAL_AUTO_ORDER_CONCURRENCY}
                onChange={(autoNormalConcurrency) => onPreferenceChange({ autoNormalConcurrency })}
              />
              <AutomationSliderField
                label="稀客等待送餐盘"
                value={preferences.autoRareTrayWaitSeconds}
                min={MIN_AUTO_WAIT_SECONDS}
                max={MAX_AUTO_WAIT_SECONDS}
                unit="秒"
                onChange={(autoRareTrayWaitSeconds) => onPreferenceChange({ autoRareTrayWaitSeconds })}
              />
              <AutomationSliderField
                label="普客保温箱复查"
                value={preferences.autoNormalStorageWaitSeconds}
                min={MIN_AUTO_WAIT_SECONDS}
                max={MAX_AUTO_WAIT_SECONDS}
                unit="秒"
                onChange={(autoNormalStorageWaitSeconds) => onPreferenceChange({ autoNormalStorageWaitSeconds })}
              />
              <AutomationSliderField
                label="最大重试"
                value={preferences.autoMaxStepRetries}
                min={MIN_AUTO_STEP_RETRIES}
                max={MAX_AUTO_STEP_RETRIES_LIMIT}
                onChange={(autoMaxStepRetries) => onPreferenceChange({ autoMaxStepRetries })}
              />
              <AutomationSliderField
                label="最大回退"
                value={preferences.autoMaxRollbacks}
                min={MIN_AUTO_ROLLBACKS}
                max={MAX_AUTO_ROLLBACKS_LIMIT}
                onChange={(autoMaxRollbacks) => onPreferenceChange({ autoMaxRollbacks })}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              参数会在下一轮自动化轮询生效。并发过高可能抢占厨具；等待时间过短可能导致重复开锅。
            </div>
          </div>
        </ListPanel>
      </TabsContent>

      {preferences.showDebugDetails && (
        <TabsContent value="debug" className="space-y-4">
          <ListPanel title="BepInEx">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SwitchControl
                  label="原生日志窗口"
                  checked={logSettings?.nativeBepInExConsoleEnabled ?? false}
                  onCheckedChange={setNativeConsoleEnabled}
                  disabled={!apiToken || consoleBusy}
                />
                <Button size="sm" variant="outline" onClick={refreshConsoleSettings} disabled={!apiToken || consoleBusy}>
                  <IconRefresh className="size-4" />
                  刷新状态
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoLine label="下次启动" value={logSettings?.nativeBepInExConsoleEnabled ? '开启' : '关闭'} />
                <InfoLine label="当前窗口" value={logSettings?.nativeBepInExConsoleVisible ? '可见' : '未显示'} />
              </div>
              <div className="text-xs text-muted-foreground">
                关闭后会隐藏当前 BepInEx 控制台，并将 BepInEx.cfg 的原生 Console log 设为下次启动关闭；日志页仍可读取 LogOutput.log。
              </div>
              {consoleError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {consoleError}
                </div>
              )}
            </div>
          </ListPanel>
        </TabsContent>
      )}
    </Tabs>
  );
}
