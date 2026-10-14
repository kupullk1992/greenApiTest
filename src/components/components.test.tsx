// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import CreateChatForm from "./CreateChatForm";
import ErrorBoundary from "./ErrorBoundary";
import Messenger from "./Messenger";
import ConnectionForm from "./ConnectionForm";
import { GreenApi } from "../api/greenApi";
import type { Message } from "../model/types";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function render(content: React.ReactNode) {
  await act(async () => {
    root.render(<StrictMode>{content}</StrictMode>);
  });
}

async function typeText(element: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;

    if (!setter) throw new Error("No textarea setter");
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const message: Message = {
  localId: "incoming",
  idMessage: "id",
  chatId: "42@lid",
  text: "Привет",
  direction: "incoming",
  timestamp: 1_700_000_000_000,
};

describe("React components", () => {
  it("отдельно показывает неопределённую попытку и подтверждённое сообщение", async () => {
    await render(
      <MessageList
        messages={[
          {
            ...message,
            localId: "attempt",
            idMessage: undefined,
            direction: "outgoing",
            status: "uncertain",
            error: "Нет ответа от GREEN-API",
          },
          {
            ...message,
            localId: "confirmed",
            direction: "outgoing",
            status: "sent",
          },
        ]}
      />,
    );

    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.textContent).toContain("Не удалось подтвердить отправку");
    expect(host.textContent).toContain(
      "Повторная отправка может создать ещё одно сообщение",
    );
  });
  it("запоминает URL при подключении и восстанавливает его без ID и токена", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);

    await render(<ConnectionForm connect={connect} />);
    const url = host.querySelector<HTMLInputElement>('[name="apiUrl"]');
    const id = host.querySelector<HTMLInputElement>('[name="idInstance"]');
    const token = host.querySelector<HTMLInputElement>('[name="token"]');
    const form = host.querySelector("form");

    if (!url || !id || !token || !form) throw new Error("No connection form");
    url.value = "https://7103.api.greenapi.com/";
    id.value = "7103000000";
    token.value = "test-placeholder";
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem("green-api:last-api-url")).toBe(
      "https://7103.api.greenapi.com",
    );
    await act(async () => {
      root.render(null);
    });
    await render(<ConnectionForm connect={connect} />);
    expect(host.querySelector<HTMLInputElement>('[name="apiUrl"]')?.value).toBe(
      "https://7103.api.greenapi.com",
    );
    expect(
      host.querySelector<HTMLInputElement>('[name="idInstance"]')?.value,
    ).toBe("");
    expect(host.querySelector<HTMLInputElement>('[name="token"]')?.value).toBe(
      "",
    );
  });
  it("открывает форму даже при запрете браузерного хранилища", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    await render(<ConnectionForm connect={vi.fn()} />);
    expect(host.querySelector<HTMLInputElement>('[name="apiUrl"]')?.value).toBe(
      "",
    );
  });
  it("открывает чат без повторяющихся ключей у списка сообщений и поля ввода", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const api = new GreenApi({
      apiUrl: "https://7103.api.greenapi.com",
      idInstance: "7103000000",
      apiTokenInstance: "test-placeholder",
    });

    vi.spyOn(api, "receive").mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    vi.spyOn(api, "checkWhatsapp").mockResolvedValue({
      chatId: "123456789012345@lid",
      aliases: ["79991234567@c.us", "123456789012345@lid"],
    });
    await render(<Messenger api={api} warning="" disconnect={() => {}} />);
    const input = host.querySelector<HTMLInputElement>("#phone");
    const form = host.querySelector("form");

    if (!input || !form) throw new Error("No chat form");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;

      if (!setter) throw new Error("No input setter");
      setter.call(input, "+7 999 1234567");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(host.querySelector('[role="log"]')).not.toBeNull();
    expect(host.querySelector("textarea")).not.toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
  it("переживает mount, update и cleanup в StrictMode без неверного возврата эффекта", async () => {
    const errors = vi.spyOn(console, "error");

    await render(<MessageList messages={[message]} />);
    await render(
      <MessageList
        messages={[
          message,
          { ...message, localId: "second", idMessage: "second", text: "Ответ" },
        ]}
      />,
    );
    await act(async () => {
      root.render(null);
    });
    expect(errors).not.toHaveBeenCalled();
  });
  it("не прокручивает входящие сообщения вниз при чтении истории", async () => {
    await render(<MessageList messages={[message]} />);
    const log = host.querySelector<HTMLElement>('[role="log"]');

    if (!log) throw new Error("No message list");
    Object.defineProperty(log, "scrollHeight", { value: 1000 });
    Object.defineProperty(log, "clientHeight", { value: 100 });
    log.scrollTop = 100;
    await act(async () => {
      log.dispatchEvent(new Event("scroll"));
    });
    await render(
      <MessageList
        messages={[
          message,
          { ...message, localId: "second", idMessage: "second" },
        ]}
      />,
    );
    expect(log.scrollTop).toBe(100);
    await render(
      <MessageList
        messages={[
          message,
          { ...message, localId: "outgoing", direction: "outgoing" },
        ]}
      />,
    );
    expect(log.scrollTop).toBe(1000);
  });
  it("сохраняет черновик при отказе отправки и не отправляет Enter во время IME", async () => {
    const send = vi.fn().mockReturnValue(false);

    await render(<MessageInput send={send} disabled={false} />);
    const input = host.querySelector("textarea");
    const form = host.querySelector("form");

    if (!input || !form) throw new Error("No composer");
    await typeText(input, "Привет");
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
        }),
      );
    });
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(send).toHaveBeenCalledWith("Привет");
    expect(input.value).toBe("Привет");
    send.mockReturnValue(true);
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(input.value).toBe("");
  });
  it("не создаёт два запроса чата при повторной отправке формы", async () => {
    let complete: (() => void) | undefined;
    const create = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );

    await render(<CreateChatForm create={create} />);
    const form = host.querySelector("form");

    if (!form) throw new Error("No form");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      complete?.();
    });
  });
  it("показывает безопасный экран при ошибке рендера", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Broken(): never {
      throw new Error("private details");
    }

    await render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(host.textContent).toContain("Не удалось отобразить приложение");
    expect(host.textContent).not.toContain("private details");
  });
});
