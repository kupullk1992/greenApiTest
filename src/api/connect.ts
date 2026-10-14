import { OPTIONAL_WEBHOOK_SETTINGS } from "./constants";
import { GreenApi } from "./greenApi";
import type { Connection } from "./types";
import type { Session } from "../types";

export async function connectInstance(
  connection: Connection,
  signal: AbortSignal,
): Promise<Session> {
  const api = new GreenApi(connection);
  const state = await api.getState(signal);

  if (state !== "authorized") {
    throw new Error(
      `Инстанс не готов (${state}). Авторизуйте WhatsApp в кабинете GREEN-API`,
    );
  }

  const settings = await api.getSettings(signal);

  if (settings.webhookUrl) {
    throw new Error(
      "Очистите webhookUrl в кабинете: HTTP polling не работает одновременно с webhook URL",
    );
  }

  if (settings.incomingWebhook !== "yes") {
    throw new Error(
      "Включите incomingWebhook в настройках инстанса для получения сообщений",
    );
  }

  const missing = OPTIONAL_WEBHOOK_SETTINGS.filter(
    (key) => settings[key] !== "yes",
  );

  return {
    api,
    warning: missing.length
      ? `Не все уведомления включены: ${missing.join(", ")}. Отправка доступна, но статусы могут не обновляться`
      : "",
  };
}
