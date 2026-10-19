"use client";

/** Replaces Next's generic "This page couldn't load" with the actual error, so crashes can be reported. */
export default function GlobalError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
        <p>Please copy the details below when reporting this.</p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, padding: 12, border: "1px solid #8884", borderRadius: 6 }}>
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <button onClick={reset} style={{ padding: "6px 12px", marginRight: 8 }}>Try again</button>
        <button onClick={() => globalThis.location.reload()} style={{ padding: "6px 12px" }}>Reload</button>
      </body>
    </html>
  );
}
