import { isRecord } from "../api/validators";
import { MESSAGE_WEBHOOK_TYPES, OUTGOING_STATUS_ERRORS } from "./constants";
import type { NotificationResult } from "./types";

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];

  if (typeof value !== "string" || !value)
    throw new Error(
      `Некорректное уведомление: отсутствует ${field}. Очередь остановлена без удаления события`,
    );

  return value;
}

export function parseNotification(
  body: Record<string, unknown>,
): NotificationResult {
  const type = requiredString(body, "typeWebhook");

  if (type === "stateInstanceChanged")
    return { kind: "state", state: requiredString(body, "stateInstance") };
  if (type === "outgoingMessageStatus") {
    const status = requiredString(body, "status");
    const mapped =
      status === "sent" || status === "delivered" || status === "read"
        ? status
        : Object.hasOwn(OUTGOING_STATUS_ERRORS, status)
          ? "error"
          : undefined;

    if (!mapped) return { kind: "ignored" };

    return {
      kind: "action",
      action: {
        type: "status",
        chatId: requiredString(body, "chatId"),
        idMessage: requiredString(body, "idMessage"),
        status: mapped,
        error: OUTGOING_STATUS_ERRORS[status],
      },
    };
  }

  if (!MESSAGE_WEBHOOK_TYPES.includes(type)) return { kind: "ignored" };
  if (!isRecord(body.senderData) || !isRecord(body.messageData))
    throw new Error("Некорректное сообщение. Событие не удалено");
  const chatId = requiredString(body.senderData, "chatId");
  const idMessage = requiredString(body, "idMessage");

  if (
    typeof body.timestamp !== "number" ||
    !Number.isSafeInteger(body.timestamp) ||
    body.timestamp < 0 ||
    !Number.isFinite(new Date(body.timestamp * 1000).getTime())
  )
    throw new Error("Некорректное время сообщения. Событие не удалено");
  const data = body.messageData;
  const typeMessage = requiredString(data, "typeMessage");
  let text = "Неподдерживаемый тип сообщения";

  if (typeMessage === "textMessage") {
    if (
      !isRecord(data.textMessageData) ||
      typeof data.textMessageData.textMessage !== "string"
    )
      throw new Error(
        "В текстовом уведомлении отсутствует текст. Событие не удалено",
      );
    text = data.textMessageData.textMessage;
  } else if (typeMessage === "extendedTextMessage") {
    if (
      !isRecord(data.extendedTextMessageData) ||
      typeof data.extendedTextMessageData.text !== "string"
    )
      throw new Error(
        "В уведомлении с URL отсутствует текст. Событие не удалено",
      );
    text = data.extendedTextMessageData.text;
  }

  const outgoing = type !== "incomingMessageReceived";

  return {
    kind: "action",
    action: {
      type: "message",
      name:
        typeof body.senderData.chatName === "string"
          ? body.senderData.chatName
          : undefined,
      message: {
        localId: `api:${chatId}:${idMessage}`,
        idMessage,
        chatId,
        text,
        timestamp: body.timestamp * 1000,
        direction: outgoing ? "outgoing" : "incoming",
        status: outgoing ? "accepted" : undefined,
      },
    },
  };
}
