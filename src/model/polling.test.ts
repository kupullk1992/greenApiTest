import { afterEach, describe, expect, it, vi } from "vitest";
import { runNotifications } from "./polling";
import { ApiError } from "../api/errors";

const receipt = {
  receiptId: 123,
  body: { typeWebhook: "incomingMessageReceived" },
};

afterEach(() => vi.useRealTimers());
describe("Последовательная очередь", () => {
  it("останавливается сразу при повреждённом ответе и не удаляет событие", async () => {
    const api = {
      receive: vi
        .fn()
        .mockRejectedValue(new ApiError("invalid receipt", undefined, false)),
      deleteNotification: vi.fn(),
    };
    const state = vi.fn();

    await runNotifications(api, new AbortController().signal, vi.fn(), state);
    expect(api.receive).toHaveBeenCalledTimes(1);
    expect(api.deleteNotification).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith({
      status: "stopped",
      error: "invalid receipt",
    });
  });
  it("отмена прерывает задержку перед повтором запроса", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const api = {
      receive: vi.fn().mockRejectedValue(new ApiError("network")),
      deleteNotification: vi.fn(),
    };
    const run = runNotifications(api, controller.signal, vi.fn(), vi.fn());

    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await run;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.receive).toHaveBeenCalledTimes(1);
  });
  it("проверяет голову очереди и повторяет удаление без повторной обработки события", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const api = {
      receive: vi.fn().mockResolvedValue(receipt),
      deleteNotification: vi
        .fn()
        .mockRejectedValueOnce(new ApiError("network"))
        .mockImplementationOnce(async () => {
          controller.abort();
        }),
    };
    const process = vi.fn();
    const run = runNotifications(api, controller.signal, process, vi.fn());

    await vi.advanceTimersByTimeAsync(1000);
    await run;
    expect(api.receive).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenCalledTimes(1);
    expect(api.deleteNotification).toHaveBeenCalledTimes(2);
  });
  it.each(["network", "Удаление уведомления не подтверждено"])(
    "сохраняет следующий receipt после неоднозначного удаления: %s",
    async (error) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const next = { ...receipt, receiptId: 124 };
      const api = {
        receive: vi
          .fn()
          .mockResolvedValueOnce(receipt)
          .mockResolvedValueOnce(next),
        deleteNotification: vi
          .fn()
          .mockRejectedValueOnce(new ApiError(error))
          .mockImplementationOnce(async () => {
            controller.abort();
          }),
      };
      const process = vi.fn();
      const state = vi.fn();
      const run = runNotifications(api, controller.signal, process, state);

      await vi.advanceTimersByTimeAsync(1000);
      await run;
      expect(api.receive).toHaveBeenCalledTimes(2);
      expect(process.mock.calls.map(([item]) => item.receiptId)).toEqual([
        123, 124,
      ]);
      expect(api.deleteNotification.mock.calls.map(([id]) => id)).toEqual([
        123, 124,
      ]);
      expect(state).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "stopped" }),
      );
    },
  );
  it("продолжает polling после исчезновения удалённого receipt из пустой очереди", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const api = {
      receive: vi
        .fn()
        .mockResolvedValueOnce(receipt)
        .mockResolvedValueOnce(null)
        .mockImplementationOnce(async () => {
          controller.abort();

          return null;
        }),
      deleteNotification: vi.fn().mockRejectedValue(new ApiError("network")),
    };
    const process = vi.fn();
    const run = runNotifications(api, controller.signal, process, vi.fn());

    await vi.advanceTimersByTimeAsync(1100);
    await run;
    expect(api.receive).toHaveBeenCalledTimes(3);
    expect(api.deleteNotification).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledTimes(1);
  });
  it("повторяет проверку очереди после сетевого сбоя и игнорирует ответ после отмены", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const api = {
      receive: vi
        .fn()
        .mockResolvedValueOnce(receipt)
        .mockRejectedValueOnce(new ApiError("network"))
        .mockImplementationOnce(async () => {
          controller.abort();

          return { ...receipt, receiptId: 124 };
        }),
      deleteNotification: vi.fn().mockRejectedValue(new ApiError("network")),
    };
    const process = vi.fn();
    const run = runNotifications(api, controller.signal, process, vi.fn());

    await vi.advanceTimersByTimeAsync(3000);
    await run;
    expect(api.receive).toHaveBeenCalledTimes(3);
    expect(api.deleteNotification).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledTimes(1);
  });
  it("не удаляет событие при ошибке обработчика", async () => {
    const api = {
      receive: vi.fn().mockResolvedValue(receipt),
      deleteNotification: vi.fn(),
    };
    const state = vi.fn();

    await runNotifications(
      api,
      new AbortController().signal,
      () => {
        throw new Error("malformed");
      },
      state,
    );
    expect(api.deleteNotification).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith({
      status: "stopped",
      error: "malformed",
    });
  });
  it("не продолжает обработку после отмены получения", async () => {
    const controller = new AbortController();
    const api = {
      receive: vi.fn().mockImplementation(async () => {
        controller.abort();

        return receipt;
      }),
      deleteNotification: vi.fn(),
    };
    const process = vi.fn();

    await runNotifications(api, controller.signal, process, vi.fn());
    expect(process).not.toHaveBeenCalled();
    expect(api.deleteNotification).not.toHaveBeenCalled();
  });
});
