import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { customersApi } from "@/api/customers";
import { extractErrorMessage } from "@/api/client";
import type { Customer } from "@/api/types";
import { useAuth } from "@/context/AuthContext";

export function CustomersPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });

  const filtered = useMemo(() => {
    const customers = customersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => matchesSearch(c, q));
  }, [customersQuery.data, search]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customersQuery.data?.length ?? 0} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
          <Button variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mb-4">
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {customersQuery.isError && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive">
                  {extractErrorMessage(customersQuery.error, "Failed to load customers")}
                </TableCell>
              </TableRow>
            )}
            {customersQuery.isSuccess && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {search ? "No matches." : "No customers yet."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((customer) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <TableCell className="font-medium">
                  {customer.first_name} {customer.last_name}
                </TableCell>
                <TableCell>{customer.email || "—"}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {customer.address || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function matchesSearch(c: Customer, q: string): boolean {
  return (
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.phone.toLowerCase().includes(q)
  );
}
