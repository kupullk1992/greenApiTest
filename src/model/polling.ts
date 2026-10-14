import { ApiError, errorMessage } from "../api/errors";
import {
  POLLING_EMPTY_DELAY_MS,
  POLLING_FATAL_HTTP_STATUSES,
  POLLING_MAX_FAILURES,
  POLLING_RETRY_BASE_MS,
  POLLING_RETRY_MAX_MS,
} from "./constants";
import type {
  NotificationApi,
  NotificationHandler,
  Receipt,
} from "../api/types";
import type { PollStateHandler } from "./types";

export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);

      return;
    }

    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);

    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function runNotifications(
  api: NotificationApi,
  signal: AbortSignal,
  onReceipt: NotificationHandler,
  onState: PollStateHandler,
): Promise<void> {
  let pending: Receipt | null = null;
  let failures = 0;
  let processed = false;
  let deletionToReconcile: number | null = null;

  while (!signal.aborted) {
    try {
      onState({ status: "receiving" });
      if (deletionToReconcile !== null) {
        const head = await api.receive(signal);

        if (signal.aborted) return;
        if (head?.receiptId !== deletionToReconcile) {
          // ReceiveNotification не извлекает событие: новый receipt ещё нужно обработать.
          pending = head;
          processed = false;
          failures = 0;
        }

        deletionToReconcile = null;
      } else {
        pending ??= await api.receive(signal);
      }

      if (signal.aborted) return;
      if (!pending) {
        failures = 0;
        await abortableDelay(POLLING_EMPTY_DELAY_MS, signal);
        continue;
      }

      if (!processed) {
        try {
          onReceipt(pending);
          processed = true;
        } catch (error) {
          onState({ status: "stopped", error: errorMessage(error) });

          return;
        }
      }

      if (signal.aborted) return;
      // При потере ответа сначала проверяем очередь, затем повторяем удаление.
      deletionToReconcile = pending.receiptId;
      await api.deleteNotification(pending.receiptId, signal);
      deletionToReconcile = null;
      pending = null;
      processed = false;
      failures = 0;
    } catch (error) {
      if (signal.aborted) return;
      failures += 1;
      if (
        (error instanceof ApiError &&
          (!error.retryable ||
            POLLING_FATAL_HTTP_STATUSES.includes(error.status ?? 0))) ||
        failures >= POLLING_MAX_FAILURES
      ) {
        onState({ status: "stopped", error: errorMessage(error) });

        return;
      }

      onState({ status: "retrying", error: errorMessage(error) });
      try {
        await abortableDelay(
          Math.min(
            POLLING_RETRY_BASE_MS * 2 ** (failures - 1),
            POLLING_RETRY_MAX_MS,
          ),
          signal,
        );
      } catch {
        return;
      }
    }
  }
}
