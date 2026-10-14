import { MESSAGE_STATUS_RANK } from "./constants";
import type { MessageStatus } from "./types";

export const messageKey = (chatId: string, id: string) => `${chatId}:${id}`;

export function mergeStatus(
  old: MessageStatus | undefined,
  next: MessageStatus,
): MessageStatus {
  return old && MESSAGE_STATUS_RANK[old] > MESSAGE_STATUS_RANK[next]
    ? old
    : next;
}

export function visibleError(
  status: MessageStatus | undefined,
  error?: string,
): string | undefined {
  return status === "error" || status === "uncertain" ? error : undefined;
}
