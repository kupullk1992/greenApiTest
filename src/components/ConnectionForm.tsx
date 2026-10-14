import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api/errors";
import { validateApiUrl, validateInstanceId } from "../api/validators";
import type { ConnectionFormProps } from "./types";
import { readApiUrl, rememberApiUrl } from "../model/connectionPreferences";

export default function ConnectionForm({ connect }: ConnectionFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedApiUrl] = useState(readApiUrl);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    const data = new FormData(event.currentTarget);

    setError("");
    try {
      const apiUrl = validateApiUrl(String(data.get("apiUrl")).trim());

      rememberApiUrl(apiUrl);
      const idInstance = validateInstanceId(String(data.get("idInstance")));
      const apiTokenInstance = String(data.get("token")).trim();

      if (!/^[a-zA-Z0-9_-]+$/.test(apiTokenInstance))
        throw new Error("Проверьте apiTokenInstance");
      const active = new AbortController();

      controller.current = active;
      setBusy(true);
      try {
        await connect({ apiUrl, idInstance, apiTokenInstance }, active.signal);
      } finally {
        if (controller.current === active) controller.current = null;
      }
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <main className="connection-page">
      <section className="connection-card">
        <div className="brand-mark">W</div>
        <p className="eyebrow">WhatsApp × GREEN-API</p>
        <form onSubmit={submit}>
          <label>
            apiUrl
            <input
              name="apiUrl"
              type="url"
              placeholder="https://7103.api.greenapi.com"
              defaultValue={savedApiUrl}
              onBlur={(event) => rememberApiUrl(event.currentTarget.value)}
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label>
            idInstance
            <input
              name="idInstance"
              inputMode="numeric"
              placeholder="7103000000"
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label>
            apiTokenInstance
            <input
              name="token"
              type="password"
              placeholder="Токен из кабинета GREEN-API"
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Проверяем подключение…" : "Подключиться"}
          </button>
        </form>
        <details>
          <summary>Перед подключением</summary>
          <p>
            В кабинете GREEN-API включите уведомления о входящих и исходящих
            сообщениях, их статусах и состоянии аккаунта. Поле адреса webhook
            оставьте пустым. Сохраните настройки и дождитесь их применения
          </p>
        </details>
      </section>
    </main>
  );
}
