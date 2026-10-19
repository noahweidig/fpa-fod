"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps one failing panel from taking down the whole page, and shows the real error. */
export default class PanelBoundary extends Component<Readonly<{ children: ReactNode }>, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Panel crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="space-y-2 text-sm" role="alert">
        <p className="font-semibold text-err">This panel failed to load.</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line p-2 text-xs">{error.message}</pre>
        <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
