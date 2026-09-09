"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            background: "#F4EFE2",
            color: "#16223A",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Algo ha ido mal.
          </p>
          <p style={{ fontSize: "0.95rem", opacity: 0.8 }}>
            Tus datos están a salvo en el servidor. Recarga la app para
            seguir.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "999px",
              border: "none",
              background: "#16223A",
              color: "#F4EFE2",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
