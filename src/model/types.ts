export type MessageStatus =
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "error"
  | "uncertain";

export interface Message {
  localId: string;
  idMessage?: string;
  chatId: string;
  text: string;
  direction: "incoming" | "outgoing";
  timestamp: number;
  status?: MessageStatus;
  error?: string;
}

export interface Chat {
  id: string;
  name: string;
  phone?: string;
}

export interface ChatState {
  aliases: Record<string, string>;
  chats: Chat[];
  messages: Message[];
  statuses: Record<string, MessageDelivery>;
}

export interface MessageDelivery {
  status: MessageStatus;
  error?: string;
}

export type ChatAction =
  | { type: "chat"; chat: Chat; aliases?: string[] }
  | { type: "message"; message: Message; name?: string }
  | { type: "accepted"; localId: string; idMessage: string }
  | { type: "sendError"; localId: string; error: string; uncertain: boolean }
  | {
      type: "status";
      chatId: string;
      idMessage: string;
      status: MessageStatus;
      error?: string;
    };

export type NotificationResult =
  | { kind: "action"; action: ChatAction }
  | { kind: "state"; state: string }
  | { kind: "ignored" };

export interface PollState {
  status: "receiving" | "retrying" | "stopped";
  error?: string;
}

export type PollStateHandler = (state: PollState) => void;
