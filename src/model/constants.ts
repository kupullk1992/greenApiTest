import type { ChatState, MessageStatus } from "./types";

export const INITIAL_CHAT_STATE: ChatState = {
  aliases: {},
  chats: [],
  messages: [],
  statuses: {},
};

export const MESSAGE_STATUS_RANK: Readonly<Record<MessageStatus, number>> = {
  sending: 0,
  uncertain: 0,
  accepted: 1,
  sent: 2,
  error: 3,
  delivered: 4,
  read: 5,
};

export const MESSAGE_WEBHOOK_TYPES = [
  "incomingMessageReceived",
  "outgoingAPIMessageReceived",
  "outgoingMessageReceived",
];

export const OUTGOING_STATUS_ERRORS: Readonly<Record<string, string>> = {
  failed: "Не удалось отправить сообщение в WhatsApp",
  noAccount: "У получателя нет аккаунта WhatsApp",
  notInGroup: "Нет доступа к группе",
  suspended: "На WhatsApp-инстансе действуют временные ограничения",
  yellowCard: "На WhatsApp-инстансе действуют временные ограничения",
};

export const POLLING_MAX_FAILURES = 6;

export const POLLING_RETRY_BASE_MS = 1000;

export const POLLING_RETRY_MAX_MS = 30_000;

export const POLLING_EMPTY_DELAY_MS = 100;

export const POLLING_FATAL_HTTP_STATUSES = [400, 401, 403];

export const API_URL_STORAGE_KEY = "green-api:last-api-url";
