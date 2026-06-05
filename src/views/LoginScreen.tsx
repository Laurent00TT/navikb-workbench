import { Eye, EyeOff, KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";

import { Banner } from "../components/Banner";

interface LoginScreenProps {
  error: string;
  onSubmit: (token: string) => void;
}

export function LoginScreen({ error, onSubmit }: LoginScreenProps) {
  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (token.trim()) {
      onSubmit(token.trim());
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="brand-mark">
          <KeyRound size={26} />
        </div>
        <h1>NaviKB</h1>
        <p>Sign in with an existing member or admin token.</p>
        <div className="token-input-wrap">
          <input
            autoFocus
            className="token-input"
            type={reveal ? "text" : "password"}
            placeholder="kb_alice_..."
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="token-reveal"
            onClick={() => setReveal((v) => !v)}
            title={reveal ? "Hide token" : "Show token"}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error ? <Banner kind="error" size="sm">{error}</Banner> : null}
        <button className="primary-button" type="submit">Open workbench</button>
        <p className="login-hint">
          Tokens are created via <code>scripts/manage_users.py</code>. The plaintext is shown once on
          creation — store it in a password manager.
        </p>
      </form>
    </main>
  );
}
