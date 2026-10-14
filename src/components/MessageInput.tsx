import { useState, type SubmitEvent, type KeyboardEvent } from "react";
import { MESSAGE_LIMIT } from "../config";
import type { MessageInputProps } from "./types";

export default function MessageInput({ send, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const valid = !!text.trim() && text.length <= MESSAGE_LIMIT && !disabled;

  function submit(event?: SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!valid) return;
    if (send(text)) setText("");
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-field">
        <textarea
          aria-label="Текст сообщения"
          placeholder="Напишите сообщение…"
          rows={2}
          maxLength={MESSAGE_LIMIT}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyDown}
          disabled={disabled}
        />
        <div className="composer-hint">
          <span>Enter — отправить · Shift+Enter — новая строка</span>
          <span>
            {text.length}/{MESSAGE_LIMIT}
          </span>
        </div>
      </div>
      <button
        className="send-button"
        aria-label="Отправить сообщение"
        disabled={!valid}
      >
        ↑
      </button>
    </form>
  );
}
