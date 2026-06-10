import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";

import { Banner } from "../components/Banner";

interface LoginScreenProps {
  error: string;
  onSubmit: (token: string) => void;
}

/** Asymmetric Swiss layout: the oversized wordmark owns the left column,
 *  the token form sits right of a 1px structural divide. A single 2px ink
 *  line runs across the whole page under the overline row. */
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
      <div className="login-left">
        <div className="el login-over">NAVIKB — NAVIGATION-FIRST KNOWLEDGE BASE</div>
        <div className="el login-wordmark">
          Navi<span>KB</span>
        </div>
        <p className="el login-tagline">
          Browse the library, <b>inspect navigation and evidence</b>, search, and upload — against
          a running NaviKB core.
        </p>
        <div className="el login-foot">
          core /ui/api · thin client <em>+</em>
          <br />
          apache-2.0 · english-only ui
        </div>
      </div>
      <div className="login-right">
        <div className="el login-over">SIGN IN</div>
        <form className="el login-panel" onSubmit={handleSubmit}>
          <h1>Sign in</h1>
          <p>with an existing member or admin token.</p>
          <label className="token-label" htmlFor="token-input">
            API TOKEN
          </label>
          <div className="token-input-wrap">
            <input
              id="token-input"
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
          <button className="primary-button" type="submit">
            Open workbench
          </button>
          <p className="login-hint">
            Tokens are created via <code>scripts/manage_users.py</code>. The plaintext is shown once
            on creation — store it in a password manager.
          </p>
        </form>
      </div>
    </main>
  );
}
