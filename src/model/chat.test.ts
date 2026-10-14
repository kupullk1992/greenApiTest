import { describe, expect, it } from "vitest";
import { chatReducer } from "./chatReducer";
import { INITIAL_CHAT_STATE } from "./constants";
import type { ChatState, Message } from "./types";
import { parseNotification } from "./notification";
import { normalizePhone, validateApiUrl } from "../api/validators";

const message: Message = {
  localId: "local",
  chatId: "42",
  text: "Привет",
  direction: "outgoing",
  timestamp: 1000,
  status: "sending",
};

describe("Объединение сообщений и статусов", () => {
  it("не оставляет ошибку на прочитанном сообщении при запоздалом failed", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, {
      type: "message",
      message: { ...message, idMessage: "id", status: "read" },
    });

    state = chatReducer(state, {
      type: "status",
      chatId: message.chatId,
      idMessage: "id",
      status: "error",
      error: "late failure",
    });
    expect(state.messages[0].status).toBe("read");
    expect(state.messages[0].error).toBeUndefined();
    state = chatReducer(state, {
      type: "message",
      message: {
        ...message,
        localId: "echo",
        idMessage: "id",
        timestamp: 99_000,
        status: "accepted",
      },
    });
    expect(state.messages[0].timestamp).toBe(message.timestamp);
    expect(state.messages[0].status).toBe("read");
    expect(state.messages[0].error).toBeUndefined();
  });
  it("после успешной доставки очищает прежнюю ошибку", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, {
      type: "message",
      message: {
        ...message,
        idMessage: "id",
        status: "error",
        error: "failure",
      },
    });

    state = chatReducer(state, {
      type: "status",
      chatId: message.chatId,
      idMessage: "id",
      status: "delivered",
    });
    expect(state.messages[0].status).toBe("delivered");
    expect(state.messages[0].error).toBeUndefined();
  });
  it("объединяет телефонный чат с LID и направляет новые ответы в тот же чат", () => {
    const phoneId = "79991234567@c.us";
    const lid = "123456789012345@lid";
    let state = chatReducer(INITIAL_CHAT_STATE, {
      type: "message",
      message: {
        ...message,
        chatId: phoneId,
        idMessage: "incoming",
        direction: "incoming",
      },
    });

    state = chatReducer(state, {
      type: "chat",
      chat: { id: lid, name: "+79991234567", phone: "79991234567" },
      aliases: [phoneId, lid],
    });
    state = chatReducer(state, {
      type: "message",
      message: {
        ...message,
        localId: "reply",
        chatId: phoneId,
        idMessage: "reply",
        direction: "incoming",
      },
    });
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].id).toBe(lid);
    expect(state.messages.every((item) => item.chatId === lid)).toBe(true);
  });
  it("сопоставляет статус с телефонным ID и отправку по LID", () => {
    const phoneId = "79991234567@c.us";
    const lid = "123456789012345@lid";
    let state = chatReducer(INITIAL_CHAT_STATE, {
      type: "status",
      chatId: phoneId,
      idMessage: "id",
      status: "read",
    });

    state = chatReducer(state, {
      type: "chat",
      chat: { id: lid, name: "Contact" },
      aliases: [phoneId, lid],
    });
    state = chatReducer(state, {
      type: "message",
      message: { ...message, chatId: lid },
    });
    state = chatReducer(state, {
      type: "accepted",
      localId: "local",
      idMessage: "id",
    });
    expect(state.messages[0].status).toBe("read");
  });
  it("объединяет echo, пришедшее раньше ответа sendMessage", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, { type: "message", message });

    state = chatReducer(state, {
      type: "message",
      message: {
        ...message,
        localId: "echo",
        idMessage: "api-id",
        status: "accepted",
      },
    });
    state = chatReducer(state, {
      type: "accepted",
      localId: "local",
      idMessage: "api-id",
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].localId).toBe("local");
    expect(state.messages[0].idMessage).toBe("api-id");
  });
  it("сохраняет ранний статус и не понижает прочитанное сообщение", () => {
    let state: ChatState = chatReducer(INITIAL_CHAT_STATE, {
      type: "status",
      chatId: "42",
      idMessage: "id",
      status: "read",
    });

    state = chatReducer(state, { type: "message", message });
    state = chatReducer(state, {
      type: "accepted",
      localId: "local",
      idMessage: "id",
    });
    state = chatReducer(state, {
      type: "status",
      chatId: "42",
      idMessage: "id",
      status: "delivered",
    });
    expect(state.messages[0].status).toBe("read");
  });
  it("исключает повторное входящее сообщение", () => {
    const incoming = {
      ...message,
      idMessage: "incoming",
      direction: "incoming" as const,
    };
    const state = chatReducer(
      chatReducer(INITIAL_CHAT_STATE, { type: "message", message: incoming }),
      { type: "message", message: incoming },
    );

    expect(state.messages).toHaveLength(1);
  });
});
describe("Контракты WhatsApp", () => {
  it("отклоняет дату, которая обрушила бы форматирование сообщений", () => {
    expect(() =>
      parseNotification({
        typeWebhook: "incomingMessageReceived",
        idMessage: "id",
        timestamp: Number.MAX_SAFE_INTEGER,
        senderData: { chatId: "42@lid" },
        messageData: {
          typeMessage: "textMessage",
          textMessageData: { textMessage: "Text" },
        },
      }),
    ).toThrow("время");
  });
  it("обрабатывает sent и ограничения аккаунта WhatsApp", () => {
    expect(
      parseNotification({
        typeWebhook: "outgoingMessageStatus",
        idMessage: "1",
        chatId: "42@lid",
        status: "sent",
      }),
    ).toMatchObject({ kind: "action", action: { status: "sent" } });
    expect(
      parseNotification({
        typeWebhook: "outgoingMessageStatus",
        idMessage: "1",
        chatId: "42@lid",
        status: "suspended",
      }),
    ).toMatchObject({ kind: "action", action: { status: "error" } });
  });
  it("читает ошибки исходящих сообщений", () => {
    expect(
      parseNotification({
        typeWebhook: "outgoingMessageStatus",
        idMessage: "1",
        chatId: "42",
        status: "noAccount",
      }),
    ).toMatchObject({ kind: "action", action: { status: "error" } });
  });
  it("останавливает обработку повреждённого текстового события", () => {
    expect(() =>
      parseNotification({
        typeWebhook: "incomingMessageReceived",
        idMessage: "1",
        timestamp: 100,
        senderData: { chatId: "42" },
        messageData: { typeMessage: "textMessage" },
      }),
    ).toThrow();
  });
  it("разрешает пропуск служебного события", () => {
    expect(parseNotification({ typeWebhook: "someFutureEvent" })).toEqual({
      kind: "ignored",
    });
  });
  it("нормализует поддерживаемые номера без добавления WhatsApp суффикса", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("79991234567");
    expect(normalizePhone("+375 29 1234567")).toBe("375291234567");
    expect(normalizePhone("+44 1234 567890")).toBe("441234567890");
    expect(normalizePhone("1234567890123456")).toBe("1234567890123456");
    expect(() => normalizePhone("1234567890")).toThrow();
    expect(() => normalizePhone("abc79991234567")).toThrow();
  });
  it("не отправляет токен на произвольный хост", () => {
    expect(validateApiUrl("https://api.greenapi.com")).toBe(
      "https://api.greenapi.com",
    );
    expect(validateApiUrl("https://api.green-api.com")).toBe(
      "https://api.green-api.com",
    );
    expect(validateApiUrl("https://7103.api.greenapi.com/")).toBe(
      "https://7103.api.greenapi.com",
    );
    expect(() =>
      validateApiUrl("https://7103.api.greenapi.com.evil.example"),
    ).toThrow();
    expect(() => validateApiUrl("http://3100.api.green-api.com")).toThrow();
  });
});
