"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, PageResponse, User, UserRole, api, shortId } from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { Empty, Notice, PageHeading } from "./ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const roles: UserRole[] = ["AUDITOR", "OPERATOR", "TREASURY_ADMIN"];

export function UsersPage() {
  const store = useWorkspace();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selected, setSelected] = useState<User>();
  const [role, setRole] = useState<UserRole>("AUDITOR");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pageRequest = useRef(0);
  const selectedId = useRef<string | null>(null);

  const fetchPage = useCallback(async (pageIndex: number) => {
    const query = new URLSearchParams({ page: String(pageIndex), size: "10" });
    return api<PageResponse<User>>(`users?${query}`);
  }, []);

  const loadPage = useCallback(async (pageIndex = page) => {
    if (store.mode !== "live" || store.role !== "TREASURY_ADMIN") return;
    const requestNumber = ++pageRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchPage(pageIndex);
      if (requestNumber !== pageRequest.current) return;
      setUsers(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setSelected((current) => {
        const id = selectedId.current ?? current?.id;
        return result.content.find((user) => user.id === id) ?? current;
      });
      const refreshedSelected = result.content.find((user) => user.id === selectedId.current);
      if (refreshedSelected) setRole(refreshedSelected.role);
      setUncertain(false);
    } catch (cause) {
      if (requestNumber === pageRequest.current) setError((cause as Error).message || "Users could not be loaded.");
    } finally {
      if (requestNumber === pageRequest.current) setLoading(false);
    }
  }, [fetchPage, page, store.mode, store.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(page), 0);
    return () => {
      window.clearTimeout(timer);
      pageRequest.current += 1;
    };
  }, [loadPage, page]);

  function selectUser(user: User) {
    if (user.role === "CUSTOMER") return;
    selectedId.current = user.id;
    setSelected(user);
    setRole(user.role);
    setReason("");
    setError("");
    setUncertain(false);
  }

  async function confirmRoleChange() {
    if (!selected || store.mode !== "live" || store.role !== "TREASURY_ADMIN" || role === selected.role || !reason.trim() || reason.trim().length > 255 || saving || uncertain) return;
    setSaving(true);
    setConfirming(false);
    setError("");
    const userId = selected.id;
    try {
      const updated = await api<User>(`users/${encodeURIComponent(userId)}/role`, {
        role,
        reason: reason.trim(),
      });
      setSelected(updated);
      setRole(updated.role);
      setReason("");
      setUncertain(false);
      await loadPage(page);
      if (updated.id === store.sessionUserId) await store.refreshSession();
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : 0;
      const message = (cause as Error).message || "The role change could not be confirmed.";
      if (status >= 500 || status === 0) {
        setUncertain(true);
        await store.refreshSession();
        try {
          const latestPage = await fetchPage(page);
          setUsers(latestPage.content);
          setTotalElements(latestPage.totalElements);
          setTotalPages(latestPage.totalPages);
          const latest = latestPage.content.find((user) => user.id === userId);
          if (latest) {
            setSelected(latest);
            setRole(latest.role);
            if (latest.id === store.sessionUserId) await store.refreshSession();
            setError(`${message} The request outcome is uncertain. The latest persisted role for ${latest.email} is ${latest.role}; check the audit trail before attempting another change.`);
          } else {
            setError(`${message} The request outcome is uncertain. Refresh users and inspect the selected account before making another role change.`);
          }
        } catch {
          setError(`${message} The request outcome is uncertain, and the user’s current role could not be reloaded. Refresh users before trying again.`);
        }
      } else {
        if (status === 403) await store.refreshSession();
        if (status === 409 || status === 403) await loadPage(page);
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = store.role === "TREASURY_ADMIN";
  const isCustomer = selected?.role === "CUSTOMER";
  const canSubmit = !!selected && !isCustomer && isAdmin && store.mode === "live" && role !== selected.role && !!reason.trim() && reason.trim().length <= 255 && !saving && !uncertain;
  const isSelf = !!selected && selected.id === store.sessionUserId;

  return (
    <>
      <PageHeading title="Users and roles" description="Review workspace access and record every role change." />
      {store.mode === "demo" ? (
        <section className="panel">
          <Empty title="Persisted users are unavailable in demo mode">
            Demo mode contains synthetic financial data only. Switch to Local API to review and change persisted user roles.
          </Empty>
        </section>
      ) : !isAdmin ? (
        <section className="panel">
          {error && <Notice danger>{error}</Notice>}
          <Notice danger>Only a Treasury Admin can view workspace users.</Notice>
        </section>
      ) : (
        <>
          <Notice>Role changes take effect immediately. Each change requires a reason and is recorded in the audit trail.</Notice>
          {error && <Notice danger>{error}</Notice>}
          <div className="users-layout">
            <section className="panel users-list" aria-label="Workspace users">
              <div className="toolbar">
                <span>{totalElements} user{totalElements === 1 ? "" : "s"}</span>
                <button disabled={loading} onClick={() => void loadPage(page)}>{loading ? "Refreshing…" : "Refresh users"}</button>
              </div>
              {loading && users.length === 0 ? <p className="panel-note">Loading users…</p> : users.length === 0 ? (
                <Empty title="No users found">User access is managed through the Local API.</Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Email</th><th>Role</th><th>Account</th><th /></tr></thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} aria-selected={selected?.id === user.id}>
                          <td>{user.email}{user.id === store.sessionUserId && <small className="user-self">You</small>}</td>
                          <td><span className="badge">{user.role}</span></td>
                          <td className="mono">{shortId(user.id)}</td>
                          <td>{user.role === "CUSTOMER" ? <span className="muted">Customer wallet account</span> : <button className="link plain" disabled={saving} onClick={() => selectUser(user)}>{selected?.id === user.id ? "Selected" : "Review"}</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="table-footer">
                <span>Page {totalPages ? page + 1 : 0} of {totalPages}</span>
                <div className="inline">
                  <button disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
                  <button disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
                </div>
              </div>
            </section>

            <section className="panel users-detail" aria-label="Selected user">
              {!selected ? <Empty title="Select a user">Account details and role controls appear here.</Empty> : (
                <>
                  <div className="section-heading"><h2>User details</h2><span className="badge">{selected.role}</span></div>
                  <dl className="detail-list">
                    <dt>Email</dt><dd>{selected.email}{isSelf ? " · You" : ""}</dd>
                    <dt>User ID</dt><dd className="mono wrap">{selected.id}</dd>
                    <dt>Current role</dt><dd>{selected.role}</dd>
                  </dl>
                  {isCustomer ? (
                    <Notice>Customer wallet accounts are read-only here. Their wallet role cannot be changed through staff role management.</Notice>
                  ) : <div className="decision-form">
                    <label htmlFor="user-role">Workspace role</label>
                    <select id="user-role" aria-label="Workspace role" value={role} disabled={saving || uncertain} onChange={(event) => { setRole(event.target.value as UserRole); setUncertain(false); setError(""); }}>
                      {roles.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                    </select>
                    <label htmlFor="user-role-reason">Reason</label>
                    <textarea id="user-role-reason" aria-label="Role change reason" maxLength={255} value={reason} disabled={saving || uncertain} onChange={(event) => setReason(event.target.value)} placeholder="Record why access is changing" />
                    <small>{reason.length}/255 characters · required</small>
                    <button className="primary" disabled={!canSubmit} onClick={() => setConfirming(true)}>{saving ? "Saving…" : "Review role change"}</button>
                  </div>}
                </>
              )}
            </section>
          </div>
        </>
      )}

      <AlertDialog open={confirming && !!selected} onOpenChange={setConfirming}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm role change</AlertDialogTitle>
            <AlertDialogDescription>
              {selected && `Change ${selected.email} from ${selected.role.replaceAll("_", " ")} to ${role.replaceAll("_", " ")}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selected && <dl className="detail-list user-confirm-reason"><dt>Reason</dt><dd>{reason.trim()}</dd></dl>}
          {isSelf && <Notice>This changes your own workspace access immediately. The Users link will disappear if you remove your Treasury Admin role.</Notice>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void confirmRoleChange()}>{saving ? "Saving…" : "Confirm role change"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
