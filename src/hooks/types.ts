import type { Chat, ChatState, Message, PollState } from "../model/types";
import type { CreateChatHandler, SendMessageHandler } from "../types";
import type { Receipt } from "../api/types";

export interface NotificationsResult extends PollState {
  retry: () => void;
}

export interface MessengerResult {
  state: ChatState;
  selectedId: string | null;
  chat: Chat | undefined;
  messages: Message[];
  latestMessages: Map<string, Message>;
  instanceState: string;
  polling: NotificationsResult;
  mobileChat: boolean;
  create: CreateChatHandler;
  send: SendMessageHandler;
  selectChat: (id: string) => void;
  showChatList: () => void;
}

export interface PendingReceipt {
  signal: AbortSignal;
  resolve: (receipt: Receipt) => void;
  done: boolean;
}
