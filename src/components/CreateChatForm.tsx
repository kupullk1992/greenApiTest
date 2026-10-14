import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api/errors";
import type { CreateChatFormProps } from "./types";

export default function CreateChatForm({ create }: CreateChatFormProps) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await create(phone);
      if (mounted.current) setPhone("");
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <form className="create-chat" onSubmit={submit}>
      <label htmlFor="phone">Новый разговор</label>
      <div className="input-row">
        <input
          id="phone"
          type="tel"
          placeholder="Номер с кодом страны…"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          disabled={busy}
        />
        <button className="primary" disabled={busy} aria-label="Создать чат">
          {busy ? "…" : "+"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
