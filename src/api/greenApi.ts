import type { Connection, Receipt, Settings, WhatsappAccount } from "./types";
import {
  HTTP_ERROR_MESSAGES,
  RECEIVE_TIMEOUT_SECONDS,
  REQUEST_TIMEOUT_MS,
} from "./constants";
import { ApiError } from "./errors";
import { isRecord, isSettings } from "./validators";

export class GreenApi {
  constructor(private readonly connection: Connection) {}

  private async request(
    method: string,
    verb: string,
    signal: AbortSignal,
    body?: unknown,
    suffix = "",
  ): Promise<unknown> {
    const { apiUrl, idInstance, apiTokenInstance } = this.connection;
    const url = `${apiUrl}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: verb,
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ]),
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError("Нет ответа от GREEN-API. Проверьте сеть и apiUrl");
    }

    if (!response.ok) {
      throw new ApiError(
        HTTP_ERROR_MESSAGES[response.status] ??
          `Ошибка GREEN-API (HTTP ${response.status})`,
        response.status,
      );
    }

    let text: string;

    try {
      text = await response.text();
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError(
        "Ответ GREEN-API не получен полностью. Проверьте соединение",
      );
    }

    if (!text.trim()) return null;
    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("GREEN-API вернул некорректный JSON");
    }

    if (isRecord(data) && data.status === "error") {
      const invalidParam = data.code === "INVALID_PARAM";

      throw new ApiError(
        invalidParam
          ? "GREEN-API отклонил параметры запроса. Проверьте настройки инстанса и пустой webhookUrl"
          : "GREEN-API не выполнил операцию",
        undefined,
        !invalidParam,
      );
    }

    if (
      isRecord(data) &&
      (data.status === false ||
        (typeof data.code === "number" && data.code >= 400))
    ) {
      throw new ApiError(
        "GREEN-API не выполнил операцию. Проверьте авторизацию инстанса и ограничения аккаунта",
      );
    }

    return data;
  }

  async getState(signal: AbortSignal): Promise<string> {
    const data = await this.request("getStateInstance", "GET", signal);

    if (!isRecord(data) || typeof data.stateInstance !== "string")
      throw new ApiError("Некорректный ответ состояния инстанса");

    return data.stateInstance;
  }

  async getSettings(signal: AbortSignal): Promise<Settings> {
    const data = await this.request("getSettings", "GET", signal);

    if (!isSettings(data))
      throw new ApiError("Некорректный ответ настроек инстанса");

    return data;
  }

  async checkWhatsapp(
    phone: string,
    signal: AbortSignal,
  ): Promise<WhatsappAccount> {
    const data = await this.request("checkWhatsapp", "POST", signal, {
      chatId: `${phone}@c.us`,
    });

    if (!isRecord(data) || typeof data.existsWhatsapp !== "boolean")
      throw new ApiError("Некорректный ответ проверки номера");
    if (!data.existsWhatsapp)
      throw new ApiError(
        "Аккаунт WhatsApp по этому номеру не найден или недоступен для поиска",
      );

    const phoneChatId = `${phone}@c.us`;

    if (
      data.chatId !== undefined &&
      (typeof data.chatId !== "string" ||
        !/^\d+@(?:lid|c\.us)$/.test(data.chatId))
    ) {
      throw new ApiError("В ответе проверки номера некорректный chatId");
    }

    const chatId = typeof data.chatId === "string" ? data.chatId : phoneChatId;

    return { chatId, aliases: [...new Set([chatId, phoneChatId])] };
  }

  async sendMessage(
    chatId: string,
    message: string,
    signal: AbortSignal,
  ): Promise<string> {
    const data = await this.request("sendMessage", "POST", signal, {
      chatId,
      message,
    });

    if (
      !isRecord(data) ||
      typeof data.idMessage !== "string" ||
      !data.idMessage
    )
      throw new ApiError("В ответе отправки отсутствует idMessage");

    return data.idMessage;
  }

  async receive(signal: AbortSignal): Promise<Receipt | null> {
    const data = await this.request(
      "receiveNotification",
      "GET",
      signal,
      undefined,
      `?receiveTimeout=${RECEIVE_TIMEOUT_SECONDS}`,
    );

    if (data === null) return null;
    if (
      !isRecord(data) ||
      typeof data.receiptId !== "number" ||
      !Number.isSafeInteger(data.receiptId) ||
      data.receiptId <= 0 ||
      !isRecord(data.body)
    )
      throw new ApiError(
        "Некорректное уведомление. Очередь не подтверждена",
        undefined,
        false,
      );

    return { receiptId: data.receiptId, body: data.body };
  }

  async deleteNotification(
    receiptId: number,
    signal: AbortSignal,
  ): Promise<void> {
    const data = await this.request(
      "deleteNotification",
      "DELETE",
      signal,
      undefined,
      `/${receiptId}`,
    );

    if (!isRecord(data) || data.result !== true)
      throw new ApiError("Удаление уведомления не подтверждено");
  }
}
