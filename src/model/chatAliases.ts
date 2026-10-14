import { messageKey, mergeStatus, visibleError } from "./messageState";
import type { Chat, ChatState, Message } from "./types";

export function registerChatAliases(
  state: ChatState,
  id: string,
  ids: string[],
): ChatState {
  const mergedIds = new Set([id, ...ids]);

  for (const alias of ids) {
    if (state.aliases[alias]) mergedIds.add(state.aliases[alias]);
  }

  const aliases = { ...state.aliases };

  for (const [alias, target] of Object.entries(aliases)) {
    if (mergedIds.has(target)) aliases[alias] = id;
  }

  for (const alias of mergedIds) aliases[alias] = id;
  const canonical = (chatId: string) => aliases[chatId] ?? chatId;
  const messages = new Map<string, Message>();

  for (const message of state.messages) {
    const chatId = canonical(message.chatId);
    const entryKey = messageKey(chatId, message.idMessage ?? message.localId);
    const previous = messages.get(entryKey);
    const status = message.status
      ? mergeStatus(previous?.status, message.status)
      : previous?.status;

    messages.set(entryKey, {
      ...message,
      chatId,
      localId: previous?.localId ?? message.localId,
      timestamp: previous?.timestamp ?? message.timestamp,
      status,
      error: visibleError(status, message.error ?? previous?.error),
    });
  }

  const chats = new Map<string, Chat>();

  for (const chat of state.chats) {
    const chatId = canonical(chat.id);

    chats.set(chatId, { ...chat, id: chatId });
  }

  const statuses: ChatState["statuses"] = {};

  for (const [statusKey, value] of Object.entries(state.statuses)) {
    const split = statusKey.indexOf(":");
    const canonicalKey = messageKey(
      canonical(statusKey.slice(0, split)),
      statusKey.slice(split + 1),
    );
    const status = mergeStatus(statuses[canonicalKey]?.status, value.status);

    statuses[canonicalKey] = {
      ...value,
      status,
      error: visibleError(status, value.error ?? statuses[canonicalKey]?.error),
    };
  }

  return {
    chats: [...chats.values()],
    messages: [...messages.values()].map((message) => {
      const pending = message.idMessage
        ? statuses[messageKey(message.chatId, message.idMessage)]
        : undefined;
      const status = pending
        ? mergeStatus(message.status, pending.status)
        : message.status;

      return {
        ...message,
        status,
        error: visibleError(status, pending?.error ?? message.error),
      };
    }),
    statuses,
    aliases,
  };
}
