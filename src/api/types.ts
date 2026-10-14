export interface Connection {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface Receipt {
  receiptId: number;
  body: Record<string, unknown>;
}

export interface NotificationApi {
  receive(signal: AbortSignal): Promise<Receipt | null>;
  deleteNotification(receiptId: number, signal: AbortSignal): Promise<void>;
}

export type NotificationHandler = (receipt: Receipt) => void;

export interface WhatsappAccount {
  chatId: string;
  aliases: string[];
}

export interface Settings {
  webhookUrl: string;
  incomingWebhook: string;
  outgoingAPIMessageWebhook: string;
  outgoingMessageWebhook: string;
  outgoingWebhook: string;
  stateWebhook: string;
}
