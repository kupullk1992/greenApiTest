import { useEffect, useState } from "react";
import type { NotificationApi, NotificationHandler } from "../api/types";
import { runNotifications } from "../model/polling";
import type { PollState } from "../model/types";
import type { NotificationsResult } from "./types";

export function useNotifications(
  api: NotificationApi,
  onReceipt: NotificationHandler,
): NotificationsResult {
  const [state, setState] = useState<PollState>({ status: "receiving" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void runNotifications(api, controller.signal, onReceipt, setState);

    return () => controller.abort();
  }, [api, onReceipt, attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
