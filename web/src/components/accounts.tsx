"use client";
import Link from "next/link";
import { useState } from "react";
import { Account, TREASURY, api, cents, money, shortId, stamp } from "@/lib/domain";
import { Icon, useWorkspace } from "./workspace";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
import { useFeedback } from "./feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function AccountsPage() {
  const store = useWorkspace();
  const { notify } = useFeedback();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusAccount, setStatusAccount] = useState<Account>();
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
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
          <button className="primary" disabled={!store.permissions.create} onClick={() => setOpen(true)}>
            <Icon name="plus" />
            Create account
          </button>
        }
      />
      <section className="summary">
        <div>
          <small>ACCOUNT BALANCES</small>
          <strong>
            {unavailable
              ? "Unavailable"
              : money(
                  accounts.reduce(
                    (n, a) => n + cents(a.currentBalance),
                    BigInt(0),
                  ),
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
            {unavailable ? "Unavailable" : accounts.length}{" "}
            <em>{!unavailable && "records"}</em>
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
          <Select
            items={[
              { value: "all", label: "All types" },
              ...["BANK", "CASH", "EWALLET"].map((value) => ({
                value,
                label: value,
              })),
            ]}
            value={type || "all"}
            onValueChange={(value) => {
              setType(value === "all" || !value ? "" : value);
              setPage(0);
            }}
          >
            <SelectTrigger
              aria-label="Account type filter"
              className="toolbar-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="ledgerflow-select">
              <SelectGroup>
                <SelectItem value="all">All types</SelectItem>
                {["BANK", "CASH", "EWALLET"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
          <Tooltip>
            <TooltipTrigger
              disabled={store.loading}
              aria-label="Refresh accounts"
              onClick={() => void store.refresh()}
            >
              <Icon name="refresh" />
            </TooltipTrigger>
            <TooltipContent>Refresh account snapshot</TooltipContent>
          </Tooltip>
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
                <th>Status</th>
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
                  <td><span className="badge">{a.frozen ? "Frozen" : "Active"}</span></td>
                  <td className="date">{stamp(a.createdAt)}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Actions for ${a.name}`}>
                        •••
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="ledgerflow-menu"
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            render={<Link href={`/ledger?account=${a.id}`} />}
                          >
                            View statement
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!store.permissions.transfer || !!a.frozen}
                            render={
                              <Link href={`/transfers?account=${a.id}`} />
                            }
                          >
                            Transfer funds
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={!store.permissions.deposit || !!a.frozen}
                            render={<Link href={`/treasury?account=${a.id}`} />}
                          >
                            Allocate from treasury
                          </DropdownMenuItem>
                          {store.mode === "live" && store.role === "TREASURY_ADMIN" && (
                            <DropdownMenuItem onClick={() => {
                              setStatusAccount(a);
                              setStatusReason("");
                              setStatusError("");
                            }}>
                              {a.frozen ? "Unfreeze account" : "Freeze account"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      {statusAccount && (
        <Modal title={statusAccount.frozen ? "Unfreeze account" : "Freeze account"}
          onClose={() => { if (!statusBusy) setStatusAccount(undefined); }}>
          <p>{statusAccount.name}</p>
          <Notice>{statusAccount.frozen ? "Allow new money movements for this account." : "Block new money movements into and out of this account. Existing records remain readable."}</Notice>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (statusBusy || store.mode !== "live" || store.role !== "TREASURY_ADMIN") return;
            const reason = statusReason.trim();
            if (!reason || reason.length > 255) return;
            setStatusBusy(true);
            setStatusError("");
            try {
              await api<Account>(`accounts/${statusAccount.id}/${statusAccount.frozen ? "unfreeze" : "freeze"}`, { reason });
              await store.refresh();
              setStatusAccount(undefined);
            } catch (e) {
              setStatusError(`${(e as Error).message} Refresh the account status before retrying if confirmation is uncertain.`);
            } finally { setStatusBusy(false); }
          }}>
            <label>Reason for status change
              <textarea aria-label="Reason for status change" maxLength={255} value={statusReason}
                disabled={statusBusy} onChange={(e) => setStatusReason(e.target.value)} required />
            </label>
            {statusError && <Notice danger>{statusError}</Notice>}
            <button className="primary" disabled={statusBusy || !statusReason.trim() || statusReason.length > 255}>
              {statusBusy ? "Submitting…" : statusAccount.frozen ? "Confirm unfreeze" : "Confirm freeze"}
            </button>
          </form>
        </Modal>
      )}
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
                const name = String(data.get("name")).trim();
                await store.create({
                  name,
                  type: data.get("type") as Account["type"],
                  openingBalance: amount,
                });
                setOpen(false);
                notify({
                  type: "success",
                  title: "Account created",
                  description: `${name} · opening balance ${money(amount)}`,
                });
              } catch (e) {
                const message = (e as Error).message;
                setError(message);
                notify({
                  type: "error",
                  title: "Account creation failed",
                  description: message,
                });
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
              <Select
                items={["BANK", "CASH", "EWALLET"].map((value) => ({
                  value,
                  label: value,
                }))}
                name="type"
                defaultValue="BANK"
              >
                <SelectTrigger aria-label="Account type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="ledgerflow-select">
                  <SelectGroup>
                    <SelectItem value="BANK">BANK</SelectItem>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="EWALLET">EWALLET</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
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
              <button className="primary" disabled={busy || !store.permissions.create}>
                {busy ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
