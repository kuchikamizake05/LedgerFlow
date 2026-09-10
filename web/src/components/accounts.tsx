"use client";
import Link from "next/link";
import { useState } from "react";
import { Account, TREASURY, cents, money, shortId, stamp } from "@/lib/domain";
import { Icon, useWorkspace } from "./workspace";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
export function AccountsPage() {
  const store = useWorkspace();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accounts = store.accounts.filter((a) => a.id !== TREASURY);
  const unavailable = store.mode === "live" && !store.checked;
  const filtered = accounts
    .filter(
      (a) =>
        (!type || a.type === type) &&
        `${a.name} ${a.id}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort
        ? cents(a.currentBalance) > cents(b.currentBalance)
          ? -1
          : 1
        : a.name.localeCompare(b.name),
    );
  const rows = filtered.slice(page * 10, page * 10 + 10);
  return (
    <>
      <PageHeading
        title="Accounts"
        description="Balances and account records."
        action={
          <button className="primary" onClick={() => setOpen(true)}>
            <Icon name="plus" />
            Create account
          </button>
        }
      />
      <section className="summary">
        <div>
          <small>ACCOUNT BALANCES</small>
          <strong>
            {unavailable ? "Unavailable" : money(
              accounts.reduce((n, a) => n + cents(a.currentBalance), BigInt(0)),
            )}
          </strong>
          <span>Excludes treasury</span>
        </div>
        <div>
          <small>TREASURY BALANCE</small>
          <strong>
            {store.accounts.find((a) => a.id === TREASURY)
              ? money(
                  store.accounts.find((a) => a.id === TREASURY)!.currentBalance,
                )
              : "Unavailable"}
          </strong>
          <span>System reserve</span>
        </div>
        <div>
          <small>ACCOUNT COUNT</small>
          <strong>
            {unavailable ? "Unavailable" : accounts.length} <em>{!unavailable && "records"}</em>
          </strong>
          <span>Ledger registers</span>
        </div>
        <div>
          <small>TRANSFER VOLUME · SESSION</small>
          <strong>
            {store.mode === "demo"
              ? money(
                  store.transfers.reduce(
                    (n, t) => n + cents(t.amount),
                    BigInt(0),
                  ),
                )
              : "Unavailable"}
          </strong>
          <span>
            {store.mode === "demo"
              ? "Session transfers"
              : "Aggregate endpoint not available"}
          </span>
        </div>
      </section>
      {store.error && (
        <Notice danger>
          {store.error}{" "}
          {store.checked && `Showing stale data from ${stamp(store.checked)}.`}
        </Notice>
      )}
      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input
              aria-label="Search accounts"
              placeholder="Search by account name or UUID…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Account type filter"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All types</option>
            {["BANK", "CASH", "EWALLET"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {(query || type) && (
            <button
              onClick={() => {
                setQuery("");
                setType("");
                setPage(0);
              }}
            >
              Clear filters
            </button>
          )}
          <span className="toolbar-end muted">
            {filtered.length} accounts found
          </span>
          <button
            disabled={store.loading}
            aria-label="Refresh accounts"
            onClick={() => void store.refresh()}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Account name</th>
                <th>Type</th>
                <th>Account ID</th>
                <th className="number">Opening balance</th>
                <th className="number" aria-sort={sort ? "descending" : "none"}>
                  <button className="plain" onClick={() => setSort(!sort)}>
                    Current balance ↓
                  </button>
                </th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link
                      className="account-name"
                      href={`/ledger?account=${a.id}`}
                    >
                      {a.name}
                    </Link>
                    <small className="subline">
                      {a.type === "BANK"
                        ? "Bank account"
                        : a.type === "CASH"
                          ? "Internal custody"
                          : "Digital wallet"}
                    </small>
                  </td>
                  <td>
                    <span className="badge">{a.type}</span>
                  </td>
                  <td>
                    <span className="mono muted">{shortId(a.id)}</span>
                    <Copy value={a.id} />
                  </td>
                  <td className="number muted">{money(a.openingBalance)}</td>
                  <td className="number">{money(a.currentBalance)}</td>
                  <td className="date">{stamp(a.createdAt)}</td>
                  <td>
                    <details className="actions">
                      <summary aria-label={`Actions for ${a.name}`}>
                        •••
                      </summary>
                      <div>
                        <Link href={`/ledger?account=${a.id}`}>
                          View statement
                        </Link>
                        <Link href={`/transfers?account=${a.id}`}>
                          Transfer
                        </Link>
                        <Link href={`/treasury?account=${a.id}`}>
                          Allocate from treasury
                        </Link>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title={
              store.loading
                ? "Loading accounts…"
                : store.error
                  ? "Account data unavailable"
                  : "No accounts found"
            }
          >
            Try refreshing or adjust your filters.
          </Empty>
        )}
        <div className="table-footer">
          <span>
            {store.checked
              ? `Snapshot · ${stamp(store.checked)}`
              : "Demo snapshot / session data"}
          </span>
          <div className="inline">
            <span>
              {filtered.length ? page * 10 + 1 : 0}–
              {Math.min((page + 1) * 10, filtered.length)} of {filtered.length}
            </span>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button
              disabled={(page + 1) * 10 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {open && (
        <Modal
          title="Create account"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setError("");
              try {
                const amount = String(data.get("balance"));
                cents(amount);
                setBusy(true);
                await store.create({
                  name: String(data.get("name")).trim(),
                  type: data.get("type") as Account["type"],
                  openingBalance: amount,
                });
                setOpen(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Account name
              <input name="name" required maxLength={100} autoFocus />
            </label>
            <label>
              Account type
              <select name="type">
                <option>BANK</option>
                <option>CASH</option>
                <option>EWALLET</option>
              </select>
            </label>
            <label>
              Opening balance · IDR
              <input
                name="balance"
                required
                defaultValue="0"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]{1,2})?"
              />
            </label>
            <p className="muted">
              Sandbox initialization. Current balance starts at the opening
              balance.
            </p>
            {error && <Notice danger>{error}</Notice>}
            <div className="form-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
