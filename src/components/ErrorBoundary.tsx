import { Component } from "react";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./types";

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="connection-page">
        <section className="connection-card" role="alert">
          <h1>Не удалось отобразить приложение</h1>
          <p className="muted">
            Начните новую сессию подключения. Если сообщение отправлялось,
            проверьте его в WhatsApp перед повторной отправкой
          </p>
          <button
            className="primary"
            onClick={() => this.setState({ failed: false })}
          >
            Вернуться к подключению
          </button>
        </section>
      </main>
    );
  }
}
