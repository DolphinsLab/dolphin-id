import { Suspense } from "react";

import { OidcCallbackViewer } from "./viewer";

export const metadata = {
  title: "OIDC Callback | Dolphin ID"
};

export default function OidcCallbackPage() {
  return (
    <main className="section">
      <div className="container">
        <p className="eyebrow">OIDC CALLBACK</p>
        <h1 className="page-title">Authorization response.</h1>
        <Suspense fallback={<p className="muted">Reading callback...</p>}>
          <OidcCallbackViewer />
        </Suspense>
      </div>
    </main>
  );
}
