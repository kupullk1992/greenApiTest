import { useEffect, useRef } from "react";
import {
  MESSAGE_STATUS_LABELS,
  DATE_FORMATTER,
  TIME_FORMATTER,
  SCROLL_FOLLOW_THRESHOLD_PX,
  UNCERTAIN_SEND_HINT,
} from "./constants";
import type { MessageListProps } from "./types";

export default function MessageList({ messages }: MessageListProps) {
  const container = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const lastId = messages.at(-1)?.localId;
  const lastDirection = messages.at(-1)?.direction;

  useEffect(() => {
    const element = container.current;

    if (element && (followLatest.current || lastDirection === "outgoing")) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length, lastId, lastDirection]);

  return (
    <div
      className="messages"
      ref={container}
      onScroll={() => {
        const element = container.current;

        if (element)
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            SCROLL_FOLLOW_THRESHOLD_PX;
      }}
      role="log"
      aria-label="Переписка"
      aria-live="polite"
    >
      {messages.length === 0 && (
        <div className="empty-chat">
          <span>✦</span>
          <h2>Ваш новый разговор</h2>
          <p>
            Отправьте первое сообщение
            <br />
            Здесь появится переписка текущей сессии
          </p>
        </div>
      )}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const showDate =
          !previous ||
          new Date(previous.timestamp).toDateString() !==
            new Date(message.timestamp).toDateString();

        return (
          <div key={message.localId}>
            {showDate && (
              <div className="date-divider">
                {DATE_FORMATTER.format(message.timestamp)}
              </div>
            )}
            <article className={`bubble ${message.direction}`}>
              <p>{message.text}</p>
              <div className="message-meta">
                <time dateTime={new Date(message.timestamp).toISOString()}>
                  {TIME_FORMATTER.format(message.timestamp)}
                </time>
                {message.status && (
                  <span>{MESSAGE_STATUS_LABELS[message.status]}</span>
                )}
              </div>
              {message.error && (
                <p className="message-error">
                  {message.error}
                  {message.status === "uncertain" && `. ${UNCERTAIN_SEND_HINT}`}
                </p>
              )}
            </article>
          </div>
        );
      })}
    </div>
  );
}
