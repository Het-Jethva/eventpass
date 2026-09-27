"use client";

import { useState } from "react";
import { IconCheck, IconUserCheck, IconUserOff, IconShield } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminActionDialog } from "./admin-action-dialog";
import { AdminTableToolbar } from "./admin-table-toolbar";

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
      <AdminTableToolbar
        label="Search accounts by name or email"
        placeholder="Search name or email"
        value={search}
        onValueChange={setSearch}
        shown={filteredAccounts.length}
        total={accounts.length}
        noun="accounts"
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/50 text-muted-foreground">
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No accounts match that search.
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{acc.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{acc.email}</div>
                  </TableCell>
                  <TableCell>
                    {acc.isPlatformAdmin ? (
                      <Badge variant="outline" className="gap-1">
                        <IconShield aria-hidden="true" /> Administrator
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Staff</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {acc.suspended ? (
                      <Badge variant="destructive" className="gap-1">
                        <IconUserOff aria-hidden="true" /> Suspended
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <IconCheck aria-hidden="true" /> Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {acc.suspended ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(acc);
                          setActionType("reactivate");
                        }}
                      >
                        <IconUserCheck data-icon="inline-start" />
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
                        <IconUserOff data-icon="inline-start" />
                        Suspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedUser && actionType === "suspend" && (
        <AdminActionDialog
          title="Suspend this account?"
          description={`${selectedUser.email} loses access to every event immediately. Nothing they created is deleted.`}
          actionLabel="Suspend account"
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
          title="Reactivate this account?"
          description={`${selectedUser.email} regains access to their events immediately.`}
          actionLabel="Reactivate account"
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
