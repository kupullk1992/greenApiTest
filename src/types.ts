import type { GreenApi } from "./api/greenApi";
import type { Connection } from "./api/types";

export interface Session {
  api: GreenApi;
  warning: string;
}

export type ConnectHandler = (
  connection: Connection,
  signal: AbortSignal,
) => Promise<void>;

export type CreateChatHandler = (phone: string) => Promise<void>;

export type SendMessageHandler = (text: string) => boolean;
