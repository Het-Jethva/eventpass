"use client";

import { useState } from "react";
import { IconCheck, IconSearch, IconUserCheck, IconUserOff, IconShield } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminActionDialog } from "./admin-action-dialog";

export interface AccountItem {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
  isPlatformAdmin: boolean;
  createdAt: Date | string;
}

interface AdminAccountsListProps {
  accounts: AccountItem[];
  onSuspend: (userId: string, reason: string) => Promise<void>;
  onReactivate: (userId: string, reason: string) => Promise<void>;
}

export function AdminAccountsList({
  accounts,
  onSuspend,
  onReactivate,
}: AdminAccountsListProps) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AccountItem | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "reactivate" | null>(null);

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform accounts..."
            className="w-full rounded-md border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            aria-label="Search platform accounts"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Account Name & Email</th>
                <th className="px-4 py-3">Role / Privileges</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No platform accounts match your search.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{acc.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{acc.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {acc.isPlatformAdmin ? (
                        <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary gap-1">
                          <IconShield className="h-3 w-3" /> Platform Administrator
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Staff Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {acc.suspended ? (
                        <Badge variant="destructive" className="gap-1">
                          <IconUserOff className="h-3 w-3" /> Suspended
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <IconCheck className="h-3 w-3" /> Active
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {acc.suspended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(acc);
                            setActionType("reactivate");
                          }}
                        >
                          <IconUserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedUser(acc);
                            setActionType("suspend");
                          }}
                        >
                          <IconUserOff className="mr-1.5 h-3.5 w-3.5" />
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && actionType === "suspend" && (
        <AdminActionDialog
          title={`Suspend Staff Account (${selectedUser.email})`}
          description="Suspension immediately revokes online activity and access for this staff user across all events without deleting domain data."
          actionLabel="Suspend Account"
          isDestructive={true}
          isOpen={true}
          onClose={() => {
            setSelectedUser(null);
            setActionType(null);
          }}
          onConfirm={async (reason) => {
            await onSuspend(selectedUser.id, reason);
          }}
        />
      )}

      {selectedUser && actionType === "reactivate" && (
        <AdminActionDialog
          title={`Reactivate Staff Account (${selectedUser.email})`}
          description="Reactivating restores online access for this staff user immediately."
          actionLabel="Reactivate Account"
          isDestructive={false}
          isOpen={true}
          onClose={() => {
            setSelectedUser(null);
            setActionType(null);
          }}
          onConfirm={async (reason) => {
            await onReactivate(selectedUser.id, reason);
          }}
        />
      )}
    </div>
  );
}
