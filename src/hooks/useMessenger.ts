import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { GreenApi } from "../api/greenApi";
import { ApiError, errorMessage } from "../api/errors";
import { normalizePhone } from "../api/validators";
import type { Receipt } from "../api/types";
import { MESSAGE_LIMIT } from "../config";
import { chatReducer } from "../model/chatReducer";
import { INITIAL_CHAT_STATE } from "../model/constants";
import type { Message } from "../model/types";
import type { MessengerResult } from "./types";
import { parseNotification } from "../model/notification";
import { useNotifications } from "./useNotifications";

export function useMessenger(api: GreenApi): MessengerResult {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(false);
  const [instanceState, setInstanceState] = useState("authorized");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const active = new AbortController();

    controller.current = active;

    return () => {
      active.abort();
    };
  }, []);

  const onReceipt = useCallback((receipt: Receipt) => {
    const event = parseNotification(receipt.body);

    if (event.kind === "action") dispatch(event.action);
    if (event.kind === "state") setInstanceState(event.state);
  }, []);
  const polling = useNotifications(api, onReceipt);
  const selectedId = selected ? (state.aliases[selected] ?? selected) : null;
  const chat = state.chats.find((item) => item.id === selectedId);
  const messages = useMemo(
    () =>
      state.messages
        .filter((message) => message.chatId === selectedId)
        .sort((a, b) => a.timestamp - b.timestamp),
    [state.messages, selectedId],
  );
  const latestMessages = useMemo(() => {
    const latest = new Map<string, Message>();

    for (const message of state.messages) {
      const previous = latest.get(message.chatId);

      if (!previous || message.timestamp >= previous.timestamp)
        latest.set(message.chatId, message);
    }

    return latest;
  }, [state.messages]);

  async function create(phoneInput: string): Promise<void> {
    const phone = normalizePhone(phoneInput);
    const signal = controller.current?.signal;

    if (!signal || signal.aborted) return;
    const cached = state.chats.find((item) => item.phone === phone);
    const account = cached
      ? { chatId: cached.id, aliases: [] }
      : await api.checkWhatsapp(phone, signal);

    if (signal.aborted) return;
    dispatch({
      type: "chat",
      chat: { id: account.chatId, name: `+${phone}`, phone },
      aliases: account.aliases,
    });
    setSelected(account.chatId);
    setMobileChat(true);
  }

  function send(text: string): boolean {
    const signal = controller.current?.signal;

    if (
      !selectedId ||
      !signal ||
      signal.aborted ||
      instanceState !== "authorized" ||
      !text.trim() ||
      text.length > MESSAGE_LIMIT
    )
      return false;
    const chatId = selectedId;
    const localId = crypto.randomUUID();

    dispatch({
      type: "message",
      message: {
        localId,
        chatId,
        text,
        timestamp: Date.now(),
        direction: "outgoing",
        status: "sending",
      },
    });
    void api
      .sendMessage(chatId, text, signal)
      .then((idMessage) => {
        if (!signal.aborted) dispatch({ type: "accepted", localId, idMessage });
      })
      .catch((error) => {
        if (!signal.aborted)
          dispatch({
            type: "sendError",
            localId,
            error: errorMessage(error),
            uncertain:
              !(error instanceof ApiError) ||
              (error.retryable && (!error.status || error.status >= 500)),
          });
      });

    return true;
  }

  function selectChat(id: string) {
    setSelected(id);
    setMobileChat(true);
  }

  return {
    state,
    selectedId,
    chat,
    messages,
    latestMessages,
    instanceState,
    polling,
    mobileChat,
    create,
    send,
    selectChat,
    showChatList: () => setMobileChat(false),
  };
}
