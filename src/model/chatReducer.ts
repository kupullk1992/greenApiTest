import { registerChatAliases } from "./chatAliases";
import { messageKey, mergeStatus, visibleError } from "./messageState";
import type { ChatAction, ChatState } from "./types";

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "message") {
    const id = state.aliases[action.message.chatId];

    if (id) action = { ...action, message: { ...action.message, chatId: id } };
  } else if (action.type === "status") {
    action = {
      ...action,
      chatId: state.aliases[action.chatId] ?? action.chatId,
    };
  }

  switch (action.type) {
    case "chat": {
      if (action.aliases?.length)
        state = registerChatAliases(state, action.chat.id, action.aliases);
      const found = state.chats.find((chat) => chat.id === action.chat.id);

      return {
        ...state,
        chats: found
          ? state.chats.map((chat) =>
              chat.id === action.chat.id ? { ...chat, ...action.chat } : chat,
            )
          : [...state.chats, action.chat],
      };
    }

    case "message": {
      const message = action.message;
      const pending = message.idMessage
        ? state.statuses[messageKey(message.chatId, message.idMessage)]
        : undefined;
      const existing = state.messages.find(
        (item) =>
          item.chatId === message.chatId &&
          (item.localId === message.localId ||
            (!!message.idMessage && item.idMessage === message.idMessage)),
      );
      const next = {
        ...message,
        status: pending
          ? mergeStatus(message.status, pending.status)
          : message.status,
        error: visibleError(
          pending?.status ?? message.status,
          pending?.error ?? message.error,
        ),
      };

      return {
        ...state,
        chats: state.chats.some((chat) => chat.id === message.chatId)
          ? state.chats
          : [
              ...state.chats,
              { id: message.chatId, name: action.name || message.chatId },
            ],
        messages: existing
          ? state.messages.map((item) => {
              if (item !== existing) return item;
              const status = next.status
                ? mergeStatus(item.status, next.status)
                : item.status;

              return {
                ...next,
                localId: item.localId,
                timestamp: item.timestamp,
                direction: item.direction,
                status,
                error: visibleError(status, next.error ?? item.error),
              };
            })
          : [...state.messages, next],
      };
    }

    case "accepted": {
      const local = state.messages.find(
        (message) => message.localId === action.localId,
      );

      if (!local) return state;
      const pending =
        state.statuses[messageKey(local.chatId, action.idMessage)];
      const echo = state.messages.find(
        (message) =>
          message.chatId === local.chatId &&
          message.idMessage === action.idMessage,
      );
      const status = mergeStatus(echo?.status, pending?.status ?? "accepted");

      return {
        ...state,
        messages: state.messages
          .filter(
            (message) =>
              message === local ||
              message.chatId !== local.chatId ||
              message.idMessage !== action.idMessage,
          )
          .map((message) =>
            message === local
              ? {
                  ...message,
                  idMessage: action.idMessage,
                  status,
                  error: visibleError(status, pending?.error ?? echo?.error),
                }
              : message,
          ),
      };
    }

    case "sendError":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.localId === action.localId && !message.idMessage
            ? {
                ...message,
                status: action.uncertain ? "uncertain" : "error",
                error: action.error,
              }
            : message,
        ),
      };
    case "status": {
      const statusKey = messageKey(action.chatId, action.idMessage);
      const status = mergeStatus(
        state.statuses[statusKey]?.status,
        action.status,
      );

      return {
        ...state,
        statuses: {
          ...state.statuses,
          [statusKey]: {
            status,
            error: visibleError(
              status,
              action.error ?? state.statuses[statusKey]?.error,
            ),
          },
        },
        messages: state.messages.map((message) => {
          if (
            message.chatId !== action.chatId ||
            message.idMessage !== action.idMessage
          )
            return message;
          const nextStatus = mergeStatus(message.status, status);

          return {
            ...message,
            status: nextStatus,
            error: visibleError(nextStatus, action.error ?? message.error),
          };
        }),
      };
    }
  }
}
