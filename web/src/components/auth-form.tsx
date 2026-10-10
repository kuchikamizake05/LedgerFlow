"use client";

import Link from "next/link";
import { FlowMark } from "@/components/flow-mark";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register";
type ApiResponse = { message?: string; fieldErrors?: Record<string, string> };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isRegister = mode === "register";
  const title = isRegister ? "Request LedgerFlow access" : "Access operations console";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(data.message || Object.values(data.fieldErrors || {})[0] || "Unable to continue. Try again.");
        return;
      }
      if (isRegister) {
        setSuccess(true);
        return;
      }
      router.replace("/accounts");
      router.refresh();
    } catch {
      setError("Unable to reach LedgerFlow. Verify the local API and try again.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <AuthFrame>
        <div className="auth-status" role="status">
          <span className="auth-status-dot" />
          <span>Account created</span>
        </div>
        <div className="auth-copy">
          <span className="auth-kicker">IDENTITY &amp; ACCESS</span>
          <h1>Registration complete</h1>
          <p>Your account starts with AUDITOR access. Sign in to continue.</p>
        </div>
        <Link className="auth-submit" href="/auth/login">
          Continue to sign in
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <div className="auth-copy">
        <span className="auth-kicker">IDENTITY &amp; ACCESS</span>
        <h1>{title}</h1>
        <p>
          {isRegister
            ? "Create an account to request access to ledger operations."
            : "Sign in to access ledger, transfer, and treasury workflows."}
        </p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label className="auth-field">
          <span>Work email</span>
          <Input
            autoComplete="email"
            disabled={pending}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="auth-field" data-invalid={Boolean(error)}>
          <span>Password</span>
          <InputGroup>
            <InputGroupInput
              aria-invalid={Boolean(error)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              disabled={pending}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={pending}
                onClick={() => setShowPassword((current) => !current)}
                size="icon-xs"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {isRegister && <small>At least 12 characters.</small>}
        </label>
        {isRegister && (
          <label className="auth-field">
            <span>Confirm password</span>
            <Input
              autoComplete="new-password"
              disabled={pending}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
              required
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
            />
          </label>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {isRegister && (
          <p className="auth-notice">
            New accounts start with <strong>AUDITOR</strong> access. An administrator grants operational roles.
          </p>
        )}
        <Button className="auth-submit" disabled={pending} size="lg" type="submit">
          {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          {pending ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create auditor account" : "Sign in"}
        </Button>
      </form>
      <p className="auth-switch">
        {isRegister ? "Already have access?" : "Need an account?"} {" "}
        <Link href={isRegister ? "/auth/login" : "/auth/register"}>{isRegister ? "Sign in" : "Register access"}</Link>
      </p>
      <footer className="auth-security-note">
        <LockKeyhole />
        Signed session · Access follows your assigned role
      </footer>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-wordmark" href="/auth/login">
          <FlowMark />
          LedgerFlow
        </Link>
        <span className="auth-environment">LOCAL DEVELOPMENT</span>
        <Link className="auth-wallet-link" href="/wallet/login">Customer wallet sign in</Link>
      </header>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
