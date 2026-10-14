export const REQUEST_TIMEOUT_MS = 45_000;

export const RECEIVE_TIMEOUT_SECONDS = 25;

export const HTTP_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: "GREEN-API отклонил запрос. Проверьте параметры и пустой webhookUrl",
  401: "Неверные данные подключения",
  403: "Доступ запрещён. Проверьте токен и тариф",
  429: "Превышена частота запросов. Подождите перед повторной попыткой",
  469: "Ограничены проверки номеров. Приостановите создание чатов",
};

export const INSTANCE_SETTING_KEYS = [
  "webhookUrl",
  "incomingWebhook",
  "outgoingAPIMessageWebhook",
  "outgoingMessageWebhook",
  "outgoingWebhook",
  "stateWebhook",
] as const;

export const OPTIONAL_WEBHOOK_SETTINGS = [
  "outgoingAPIMessageWebhook",
  "outgoingWebhook",
  "outgoingMessageWebhook",
  "stateWebhook",
] as const;
