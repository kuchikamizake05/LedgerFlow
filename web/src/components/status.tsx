"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { stamp } from "@/lib/domain";
import { useWorkspace, Icon } from "./workspace";
import { Copy, Empty, Modal, PageHeading } from "./ui";
type Check = {
  at: string;
  status: string;
  database: string;
  duration: number;
  evidence: string;
};
export function StatusPage() {
  const { mode } = useWorkspace();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [selected, setSelected] = useState<string>();
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const start = performance.now();
    let status = "UNKNOWN",
      database = "UNKNOWN",
      evidence = "Demo mode does not check real services.";
    if (mode === "live") {
      try {
        const response = await fetch("/api/backend/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        status = result.status || "UNKNOWN";
        database = result.database || "UNKNOWN";
        evidence = result.status
          ? `Health endpoint reported ${result.status}.`
          : "Health endpoint could not be reached. Downstream state is unknown.";
      } catch {
        evidence =
          "Health request failed. This does not establish database failure.";
      }
    }
    setChecks((list) =>
      [
        {
          at: new Date().toISOString(),
          status,
          database,
          duration: Math.round(performance.now() - start),
          evidence,
        },
        ...list,
      ].slice(0, 20),
    );
    setBusy(false);
    inFlight.current = false;
  }, [mode]);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [auto, refresh]);
  const latest = checks[0];
  const success = checks.find((c) => c.status === "UP");
  const components = [
    {
      name: "API service",
      status: latest?.status || "UNKNOWN",
      evidence: latest?.evidence || "No check performed in this session.",
    },
    {
      name: "PostgreSQL",
      status: latest?.database || "UNKNOWN",
      evidence: "Only shown when the backend exposes database health details.",
    },
    {
      name: "Schema migrations",
      status: "NOT CONFIGURED",
      evidence: "Migration diagnostics are not exposed by the current API.",
    },
    {
      name: "Ledger reconciliation",
      status: "NOT CONFIGURED",
      evidence: "No global reconciliation endpoint is available.",
    },
  ];
  return (
    <>
      <PageHeading
        title="System status"
        description="Service availability and diagnostic checks."
        action={
          <div className="inline">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              Auto-refresh · 30s
            </label>
            <button disabled={busy} onClick={() => void refresh()}>
              <Icon name="refresh" />
              {busy ? "Checking…" : "Refresh status"}
            </button>
          </div>
        }
      />
      <section className="health-strip" aria-live="polite">
        <div>
          <span className={`status ${latest?.status === "UP" ? "good" : ""}`}>
            {latest?.status === "UP"
              ? "API healthy"
              : latest?.status === "DOWN"
                ? "API reported unavailable"
                : "Status unknown"}
          </span>
          <p>
            {latest?.evidence ||
              "Refresh to inspect the local health endpoint."}
          </p>
        </div>
        <div>
          <small>LAST SUCCESSFUL CHECK</small>
          <p className="mono">{stamp(success?.at)}</p>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Service checks</h2>
          <span className="muted">{stamp(latest?.at)}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.name}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>
                    <span
                      className={`status ${c.status === "UP" ? "good" : ""}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="muted">{c.evidence}</td>
                  <td>
                    <button
                      className="plain link"
                      onClick={() => setSelected(c.name)}
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Connectivity is not a guarantee of query correctness or ledger
          integrity.
        </div>
      </section>
      <section className="panel recent">
        <div className="section-heading">
          <h2>API performance</h2>
          <span className="badge">NOT CONFIGURED</span>
        </div>
        <div className="summary">
          <div>
            <small>REQUEST COUNT</small>
            <strong>—</strong>
          </div>
          <div>
            <small>SERVER-ERROR RATE</small>
            <strong>—</strong>
          </div>
          <div>
            <small>P95 REQUEST DURATION</small>
            <strong>—</strong>
          </div>
          <div>
            <small>LAST HEALTH PROBE</small>
            <strong>
              {latest && mode === "live" ? `${latest.duration} ms` : "—"}
            </strong>
          </div>
        </div>
        <p className="panel-note">
          Request-level telemetry is not configured. A health probe measures
          this browser’s check duration, not API-wide latency.
        </p>
      </section>
      <section className="panel recent">
        <div className="section-heading">
          <h2>Recent check history</h2>
          <span className="muted">This page session · up to 20 checks</span>
        </div>
        {checks.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Component</th>
                  <th>Result</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c, i) => (
                  <tr key={`${c.at}-${i}`}>
                    <td className="date">{stamp(c.at)}</td>
                    <td>API service</td>
                    <td>{c.status}</td>
                    <td className="muted">{c.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No recorded checks">
            Refresh status to start a session history. History is not persisted.
          </Empty>
        )}
      </section>
      {selected && (
        <Modal drawer title={selected} onClose={() => setSelected(undefined)}>
          <span className="badge">READ-ONLY DIAGNOSTICS</span>
          <dl className="detail-list">
            <dt>Source</dt>
            <dd>
              {mode === "demo" ? "Demo — no service call" : "/actuator/health"}
            </dd>
            <dt>Last attempt</dt>
            <dd>{stamp(latest?.at)}</dd>
            <dt>Status</dt>
            <dd>{components.find((c) => c.name === selected)?.status}</dd>
          </dl>
          <p>{components.find((c) => c.name === selected)?.evidence}</p>
          <p>
            Copy diagnostic summary{" "}
            <Copy
              value={`${selected}: ${components.find((c) => c.name === selected)?.status}. ${stamp(latest?.at)}`}
            />
          </p>
          <p className="muted">
            No credentials, raw stack traces, or destructive controls are
            exposed.
          </p>
        </Modal>
      )}
    </>
  );
}
