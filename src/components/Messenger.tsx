import type { MessengerProps } from "./types";
import { useMessenger } from "../hooks/useMessenger";
import CreateChatForm from "./CreateChatForm";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";

export default function Messenger({
  api,
  disconnect,
  warning,
}: MessengerProps) {
  const {
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
    showChatList,
  } = useMessenger(api);

  return (
    <main className={`messenger ${mobileChat ? "show-chat" : ""}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="brand-mark small">W</div>
          <div>
            <strong>WhatsApp</strong>
            <span>GREEN-API клиент</span>
          </div>
          <button className="text-button" onClick={disconnect}>
            Выйти
          </button>
        </header>
        <CreateChatForm create={create} />
        <div className="list-heading">
          Чаты <span>{state.chats.length}</span>
        </div>
        <nav className="chat-list" aria-label="Список чатов">
          {state.chats.length === 0 && (
            <p className="list-empty">
              Создайте чат по номеру телефона. Входящие сообщения также появятся
              здесь
            </p>
          )}
          {state.chats.map((item) => {
            const last = latestMessages.get(item.id);

            return (
              <button
                key={item.id}
                aria-current={selectedId === item.id ? "true" : undefined}
                className={`chat-item ${selectedId === item.id ? "selected" : ""}`}
                onClick={() => {
                  selectChat(item.id);
                }}
              >
                <span className="avatar">{item.name.slice(0, 1)}</span>
                <span className="chat-summary">
                  <strong>{item.name}</strong>
                  <span>{last?.text ?? "Пока нет сообщений"}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className={`status-dot ${polling.status}`} />
          {polling.status === "receiving"
            ? "Получение уведомлений включено"
            : polling.status === "retrying"
              ? "Восстанавливаем соединение…"
              : "Получение остановлено"}
          <p>История хранится в этой сессии</p>
          {polling.status === "stopped" && (
            <>
              <p className="error" role="alert">
                {polling.error}
              </p>
              <button className="text-button" onClick={polling.retry}>
                Повторить получение
              </button>
            </>
          )}
          {warning && <p>{warning}</p>}
          {instanceState !== "authorized" && (
            <p role="alert">
              Авторизуйте WhatsApp в кабинете GREEN-API ({instanceState}).
            </p>
          )}
        </div>
      </aside>
      <section className="conversation">
        {warning && <div className="notice">{warning}</div>}
        {instanceState !== "authorized" && (
          <div className="notice" role="alert">
            Инстанс не авторизован ({instanceState}). Авторизуйте WhatsApp в
            кабинете GREEN-API
          </div>
        )}
        {polling.error && (
          <div className="notice error" role="alert">
            {polling.error}
            {polling.status === "stopped" && (
              <button className="text-button" onClick={polling.retry}>
                Повторить получение
              </button>
            )}
          </div>
        )}
        {chat ? (
          <>
            <header className="chat-header">
              <button
                className="back-button"
                aria-label="Вернуться к чатам"
                onClick={showChatList}
              >
                ←
              </button>
              <span className="avatar">{chat.name.slice(0, 1)}</span>
              <div>
                <h1>{chat.name}</h1>
                <p>WhatsApp · чат {chat.id}</p>
              </div>
            </header>
            <MessageList key={`messages:${chat.id}`} messages={messages} />
            <MessageInput
              key={`composer:${chat.id}`}
              send={send}
              disabled={instanceState !== "authorized"}
            />
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-symbol">↗</div>
            <h1>Чат начинается здесь</h1>
            <p>
              Создайте новый чат или выберите
              <br />
              чат из списка слева
            </p>
            <span>Только текст. Всё необходимое</span>
          </div>
        )}
      </section>
    </main>
  );
}
