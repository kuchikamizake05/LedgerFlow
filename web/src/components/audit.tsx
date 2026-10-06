"use client";
import { useEffect, useState } from "react";
import { AuditEvent, PageResponse, api, shortId, stamp } from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { Copy, Empty, Notice, PageHeading } from "./ui";

export function AuditPage() {
  const store = useWorkspace();
  const [action, setAction] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResponse<AuditEvent>>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (store.mode !== "live") {
      return;
    }
    let active = true;
    const filters = new URLSearchParams({ page: String(page), size: "20" });
    if (action) filters.set("action", action);
    if (resourceId) filters.set("resourceId", resourceId);
    api<PageResponse<AuditEvent>>(`audit?${filters.toString()}`)
      .then((data) => {
        if (active) {
          setResult(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
    return () => {
      active = false;
    };
  }, [action, page, resourceId, store.mode]);

  return (
    <>
      <PageHeading
        title="Audit trail"
        description="Review attributed account and money movement events."
      />
      {store.mode === "demo" ? (
        <section className="panel">
          <Empty title="Audit trail unavailable in demo mode">
            Demo activity is synthetic and does not claim to be a persisted audit record.
          </Empty>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="toolbar">
              <label>
                Exact action
                <input
                  aria-label="Filter by exact action"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(0);
                  }}
                  placeholder="e.g. TRANSFER_REVERSED"
                />
              </label>
              <label>
                Exact resource ID
                <input
                  aria-label="Filter by exact resource ID"
                  value={resourceId}
                  onChange={(e) => {
                    setResourceId(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Paste resource UUID"
                />
              </label>
              <button
                onClick={() => {
                  setAction("");
                  setResourceId("");
                  setPage(0);
                }}
              >
                Clear filters
              </button>
            </div>
          </section>
          {error && <Notice danger>{error}</Notice>}
          <section className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Resource ID</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.content.map((event) => (
                    <tr key={event.id}>
                      <td className="date">{stamp(event.createdAt)}</td>
                      <td>{event.actorEmail || event.actorId || "System"}</td>
                      <td><span className="badge">{event.actorRole}</span></td>
                      <td className="mono">{event.action}</td>
                      <td className="mono">
                        {shortId(event.resourceId)}
                        <Copy value={event.resourceId} />
                      </td>
                      <td>{event.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!result?.content.length) && (
                <Empty title="No audit events">
                {error ? "The audit records could not be loaded." : "Adjust the exact action or resource ID filters."}
              </Empty>
            )}
            <div className="table-footer">
              <span>{result?.totalElements ?? 0} matching events · Newest events first</span>
              <div className="inline">
                <button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {(result?.page ?? page) + 1}</span>
                <button disabled={!result?.hasNext} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
