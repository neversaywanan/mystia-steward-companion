import { useEffect, useRef } from 'react';

interface UseOrderAutomationIntervalsOptions {
  automationEnabled: boolean;
  autoNormalOrderEnabled: boolean;
  normalOrderSignature: string;
  rareTickMs: number;
  normalTickMs: number;
  runAutoFirstOrder: () => Promise<void>;
  runAutoNormalOrder: () => Promise<void>;
  onAutomationDisabled: () => void;
  onNormalOrderSignatureChanged: () => void;
  onNormalAutomationDisabled: () => void;
}

export function useOrderAutomationIntervals({
  automationEnabled,
  autoNormalOrderEnabled,
  normalOrderSignature,
  rareTickMs,
  normalTickMs,
  runAutoFirstOrder,
  runAutoNormalOrder,
  onAutomationDisabled,
  onNormalOrderSignatureChanged,
  onNormalAutomationDisabled,
}: UseOrderAutomationIntervalsOptions) {
  const lastNormalOrderSignatureRef = useRef('');

  useEffect(() => {
    if (!automationEnabled) {
      onAutomationDisabled();
      return undefined;
    }

    void runAutoFirstOrder();
    const timer = window.setInterval(() => {
      void runAutoFirstOrder();
    }, rareTickMs);
    return () => window.clearInterval(timer);
  }, [automationEnabled, onAutomationDisabled, rareTickMs, runAutoFirstOrder]);

  useEffect(() => {
    if (!automationEnabled) return undefined;

    void runAutoNormalOrder();
    const timer = window.setInterval(() => {
      void runAutoNormalOrder();
    }, normalTickMs);
    return () => window.clearInterval(timer);
  }, [automationEnabled, normalTickMs, runAutoNormalOrder]);

  useEffect(() => {
    if (!automationEnabled || !autoNormalOrderEnabled) {
      lastNormalOrderSignatureRef.current = normalOrderSignature;
      return;
    }

    if (lastNormalOrderSignatureRef.current === normalOrderSignature) return;
    lastNormalOrderSignatureRef.current = normalOrderSignature;
    onNormalOrderSignatureChanged();
    void runAutoNormalOrder();
  }, [
    automationEnabled,
    autoNormalOrderEnabled,
    normalOrderSignature,
    onNormalOrderSignatureChanged,
    runAutoNormalOrder,
  ]);

  useEffect(() => {
    if (automationEnabled && autoNormalOrderEnabled) return;
    onNormalAutomationDisabled();
  }, [automationEnabled, autoNormalOrderEnabled, onNormalAutomationDisabled]);
}
