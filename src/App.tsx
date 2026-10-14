import { useState } from "react";
import { connectInstance } from "./api/connect";
import type { ConnectHandler, Session } from "./types";
import ConnectionForm from "./components/ConnectionForm";
import Messenger from "./components/Messenger";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const connect: ConnectHandler = async (connection, signal) => {
    const nextSession = await connectInstance(connection, signal);

    if (!signal.aborted) setSession(nextSession);
  };

  return session ? (
    <Messenger
      api={session.api}
      warning={session.warning}
      disconnect={() => setSession(null)}
    />
  ) : (
    <ConnectionForm connect={connect} />
  );
}
