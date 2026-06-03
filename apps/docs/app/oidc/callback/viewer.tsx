"use client";

import { useSearchParams } from "next/navigation";

export function OidcCallbackViewer() {
  const params = useSearchParams();

  return (
    <div className="panel terminal live-json">
      <div className="terminal-body">
        <pre>
          {JSON.stringify(
            {
              code: params.get("code"),
              state: params.get("state"),
              error: params.get("error")
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
