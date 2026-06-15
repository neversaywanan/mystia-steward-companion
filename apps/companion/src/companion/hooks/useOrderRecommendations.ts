import { useEffect, useRef, useState } from 'react';
import type {
  OrderRecommendationResult,
  OrderRecommendationWorkerPayload,
  OrderRecommendationWorkerRequest,
  OrderRecommendationWorkerResponse,
} from '@/companion/workers/order-recommendations.types';

interface AsyncOrderRecommendationResult extends OrderRecommendationResult {
  pending: boolean;
  isCurrent: boolean;
  error: string | null;
}

const EMPTY_RECOMMENDATIONS: OrderRecommendationResult = {
  recommendations: [],
  recommendationIssues: [],
};

export function useOrderRecommendations(
  payload: OrderRecommendationWorkerPayload,
): AsyncOrderRecommendationResult {
  const [state, setState] = useState<AsyncOrderRecommendationResult>({
    ...EMPTY_RECOMMENDATIONS,
    pending: false,
    isCurrent: true,
    error: null,
  });
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const settledRequestIdRef = useRef(0);
  const payloadRef = useRef(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/order-recommendations.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<OrderRecommendationWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== latestRequestIdRef.current) return;
      settledRequestIdRef.current = response.requestId;

      if (response.ok) {
        setState({
          ...response.result,
          pending: false,
          isCurrent: true,
          error: null,
        });
        return;
      }

      setState({
        ...buildFailureResult(payloadRef.current, response.error),
        pending: false,
        isCurrent: true,
        error: response.error,
      });
    };

    worker.onerror = (event) => {
      const message = event.message || '推荐计算 Worker 运行失败。';
      setState({
        ...buildFailureResult(payloadRef.current, message),
        pending: false,
        isCurrent: true,
        error: message,
      });
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const scheduleCurrentState = (
      buildNextState: (
        current: AsyncOrderRecommendationResult,
      ) => AsyncOrderRecommendationResult,
    ) => {
      queueMicrotask(() => {
        if (latestRequestIdRef.current !== requestId) return;
        setState(buildNextState);
      });
    };

    if (payload.orders.length === 0) {
      settledRequestIdRef.current = requestId;
      scheduleCurrentState(() => ({
        ...EMPTY_RECOMMENDATIONS,
        pending: false,
        isCurrent: true,
        error: null,
      }));
      return;
    }

    const worker = workerRef.current;
    if (!worker) {
      settledRequestIdRef.current = requestId;
      scheduleCurrentState(() => ({
        ...buildFailureResult(payload, '推荐计算 Worker 尚未初始化。'),
        pending: false,
        isCurrent: true,
        error: '推荐计算 Worker 尚未初始化。',
      }));
      return;
    }

    const request: OrderRecommendationWorkerRequest = {
      requestId,
      payload,
    };

    scheduleCurrentState((current) => {
      if (settledRequestIdRef.current === requestId) return current;
      return {
        ...current,
        pending: true,
        isCurrent: false,
        error: null,
      };
    });
    worker.postMessage(request);
  }, [payload]);

  return state;
}

function buildFailureResult(
  payload: OrderRecommendationWorkerPayload,
  message: string,
): OrderRecommendationResult {
  return {
    recommendations: [],
    recommendationIssues: payload.orders.map((order) => ({
      order,
      message,
    })),
  };
}
