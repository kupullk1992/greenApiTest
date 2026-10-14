import { afterEach, describe, expect, it, vi } from "vitest";
import { GreenApi } from "./greenApi";
import { validateInstanceId } from "./validators";

const api = new GreenApi({
  apiUrl: "https://3100.api.green-api.com",
  idInstance: "3100000000",
  apiTokenInstance: "test-secret",
});
const signal = () => new AbortController().signal;
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());
describe("HTTP API", () => {
  it("принимает idInstance без ограничения длины", () => {
    expect(validateInstanceId(" 310022762405 ")).toBe("310022762405");
    expect(validateInstanceId("3100000000")).toBe("3100000000");
    expect(() => validateInstanceId("")).toThrow();
    expect(() => validateInstanceId("3100abc")).toThrow();
  });
  it("берёт WhatsApp LID и сохраняет связь с номером без потери точности", async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply({
        existsWhatsapp: true,
        chatId: "123456789012345@lid",
        fromCache: true,
      }),
    );

    vi.stubGlobal("fetch", fetch);
    expect(await api.checkWhatsapp("79991234567", signal())).toEqual({
      chatId: "123456789012345@lid",
      aliases: ["123456789012345@lid", "79991234567@c.us"],
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      chatId: "79991234567@c.us",
    });
    expect(fetch.mock.calls[0][0]).toContain("/checkWhatsapp/");
  });
  it("распознаёт бизнес-ошибку с HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply({ status: false, reason: "not authorized" })),
    );
    await expect(api.checkWhatsapp("79991234567", signal())).rejects.toThrow(
      "не выполнил операцию",
    );
  });
  it("поддерживает старый ответ existsWhatsapp и сообщает об отсутствии аккаунта", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply({ existsWhatsapp: true }))
        .mockResolvedValueOnce(reply({ existsWhatsapp: false })),
    );
    expect(await api.checkWhatsapp("79991234567", signal())).toEqual({
      chatId: "79991234567@c.us",
      aliases: ["79991234567@c.us"],
    });
    await expect(api.checkWhatsapp("79991234567", signal())).rejects.toThrow(
      "не найден",
    );
  });
  it("распознаёт INVALID_PARAM с HTTP 200 без раскрытия сырого ответа", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({
          status: "error",
          code: "INVALID_PARAM",
          message: "Request rejected: test-secret",
        }),
      ),
    );

    await expect(api.receive(signal())).rejects.toMatchObject({
      name: "ApiError",
      retryable: false,
      message:
        "GREEN-API отклонил параметры запроса. Проверьте настройки инстанса и пустой webhookUrl",
    });
    await expect(api.receive(signal())).rejects.not.toThrow("test-secret");
  });
  it("распознаёт неизвестную бизнес-ошибку без вывода её кода и сообщения", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({
          status: "error",
          code: "test-secret",
          message: "test-secret",
        }),
      ),
    );

    await expect(api.sendMessage("42@lid", "Привет", signal())).rejects.toThrow(
      "GREEN-API не выполнил операцию",
    );
  });
  it("проверяет result удаления", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ result: false })));
    await expect(api.deleteNotification(123, signal())).rejects.toThrow(
      "не подтверждено",
    );
  });
  it("обрабатывает null и пустой ответ polling", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(null))
        .mockResolvedValueOnce(new Response("")),
    );
    expect(await api.receive(signal())).toBeNull();
    expect(await api.receive(signal())).toBeNull();
  });
  it("не раскрывает токен при HTTP ошибке", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ error: "test-secret" }, 403)),
    );
    await expect(api.getState(signal())).rejects.toThrow("Доступ запрещён");
    await expect(api.getState(signal())).rejects.not.toThrow("test-secret");
  });
  it("передаёт отмену и не принимает повреждённое уведомление", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(reply({ receiptId: "123", body: {} }));

    vi.stubGlobal("fetch", fetch);
    await expect(api.receive(signal())).rejects.toThrow(
      "Некорректное уведомление",
    );
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
