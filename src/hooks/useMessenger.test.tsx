// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { GreenApi } from "../api/greenApi";
import { ApiError } from "../api/errors";
import type { Receipt } from "../api/types";
import { useMessenger } from "./useMessenger";
import type { MessengerResult, PendingReceipt } from "./types";

it("сохраняет один polling-цикл в StrictMode, объединяет ранний статус и отменяет запросы при выходе", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const api = new GreenApi({
    apiUrl: "https://7103.api.greenapi.com",
    idInstance: "7103000000",
    apiTokenInstance: "test-placeholder",
  });
  const host = document.createElement("div");

  document.body.append(host);
  const root = createRoot(host);
  const receives: PendingReceipt[] = [];
  let active = 0;
  let maximumActive = 0;

  vi.spyOn(api, "receive").mockImplementation(
    (signal) =>
      new Promise((resolve, reject) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        const entry = {
          signal,
          resolve: (receipt: Receipt) => {
            if (entry.done) return;
            entry.done = true;
            active -= 1;
            resolve(receipt);
          },
          done: false,
        };

        receives.push(entry);
        signal.addEventListener(
          "abort",
          () => {
            if (!entry.done) {
              entry.done = true;
              active -= 1;
              reject(signal.reason);
            }
          },
          { once: true },
        );
      }),
  );
  vi.spyOn(api, "deleteNotification").mockResolvedValue();
  vi.spyOn(api, "checkWhatsapp").mockResolvedValue({
    chatId: "42@lid",
    aliases: ["42@lid", "79991234567@c.us"],
  });
  let resolveSend: ((id: string) => void) | undefined;

  vi.spyOn(api, "sendMessage").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
  );
  let model: MessengerResult | undefined;

  function Probe() {
    model = useMessenger(api);

    return null;
  }

  try {
    await act(async () => {
      root.render(
        <StrictMode>
          <Probe />
        </StrictMode>,
      );
    });
    expect(maximumActive).toBe(1);
    await act(async () => {
      await model?.create("+7 (999) 123-45-67");
    });
    await act(async () => {
      expect(model?.send("Привет")).toBe(true);
    });
    await act(async () => {
      const pending = receives.find((entry) => !entry.done);

      if (!pending) throw new Error("No polling request");
      pending.resolve({
        receiptId: 123,
        body: {
          typeWebhook: "outgoingMessageStatus",
          chatId: "79991234567@c.us",
          idMessage: "api-id",
          status: "read",
        },
      });
    });
    await act(async () => {
      resolveSend?.("api-id");
    });
    expect(model?.messages).toHaveLength(1);
    expect(model?.messages[0].status).toBe("read");
    expect(api.deleteNotification).toHaveBeenCalledWith(
      123,
      expect.any(AbortSignal),
    );
    const sendSignal = vi.mocked(api.sendMessage).mock.calls[0][2];

    vi.mocked(api.sendMessage).mockRejectedValueOnce(
      new ApiError("Неверные параметры", undefined, false),
    );
    await act(async () => {
      model?.send("Отклонённое сообщение");
    });
    expect(model?.messages.at(-1)?.status).toBe("error");

    vi.mocked(api.sendMessage).mockRejectedValueOnce(new ApiError("network"));
    await act(async () => {
      model?.send("Неподтверждённое сообщение");
    });
    expect(model?.messages.at(-1)?.status).toBe("uncertain");

    await act(async () => {
      root.render(null);
    });
    expect(sendSignal.aborted).toBe(true);
    expect(active).toBe(0);
    expect(maximumActive).toBe(1);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
