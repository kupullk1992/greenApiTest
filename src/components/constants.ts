import type { MessageStatus } from "../model/types";

export const MESSAGE_STATUS_LABELS: Readonly<Record<MessageStatus, string>> = {
  sending: "Отправляется",
  accepted: "Принято API",
  sent: "Отправлено",
  delivered: "Доставлено",
  read: "Прочитано",
  error: "Ошибка",
  uncertain: "Не удалось подтвердить отправку",
};

export const UNCERTAIN_SEND_HINT =
  "Сообщение могло быть отправлено. Повторная отправка может создать ещё одно сообщение";

export const TIME_FORMATTER = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
});

export const DATE_FORMATTER = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const SCROLL_FOLLOW_THRESHOLD_PX = 48;
