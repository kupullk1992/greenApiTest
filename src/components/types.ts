import type { ReactNode } from "react";
import type { Message } from "../model/types";
import type {
  ConnectHandler,
  CreateChatHandler,
  SendMessageHandler,
  Session,
} from "../types";

export interface ConnectionFormProps {
  connect: ConnectHandler;
}

export interface CreateChatFormProps {
  create: CreateChatHandler;
}

export interface MessageInputProps {
  send: SendMessageHandler;
  disabled: boolean;
}

export interface MessageListProps {
  messages: Message[];
}

export interface MessengerProps extends Session {
  disconnect: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  failed: boolean;
}
