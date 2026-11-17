"use client";
import { messages } from "@/i18n/messages";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <main>
          <h1>{messages.id.error}</h1>
          <p lang="en">{messages.en.error}</p>
          <button onClick={reset}>
            {messages.id.retry} / {messages.en.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
