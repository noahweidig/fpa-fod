"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="p-6 text-muted">Loading…</div>,
});

export default function ClientApp() {
  return <App />;
}
