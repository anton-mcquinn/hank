import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { customersApi } from "@/api/customers";
import { extractErrorMessage } from "@/api/client";
import type { Customer, CustomerUpdate } from "@/api/types";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
};

function toFormState(customer: Customer): FormState {
  return {
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
  };
}

function diff(initial: FormState, current: FormState): CustomerUpdate {
  const out: CustomerUpdate = {};
  (Object.keys(current) as Array<keyof FormState>).forEach((key) => {
    if (current[key] !== initial[key]) out[key] = current[key];
  });
  return out;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: Boolean(id),
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [initial, setInitial] = useState<FormState>(emptyForm);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customerQuery.data) {
      const next = toFormState(customerQuery.data);
      setForm(next);
      setInitial(next);
    }
  }, [customerQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: CustomerUpdate) => customersApi.update(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["customer", id], updated);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      const next = toFormState(updated);
      setInitial(next);
      setForm(next);
      setSavedMessage("Saved");
    },
  });

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(null), 2000);
    return () => clearTimeout(t);
  }, [savedMessage]);

  const pending = diff(initial, form);
  const hasChanges = Object.keys(pending).length > 0;

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges) return;
    mutation.mutate(pending);
  }

  if (customerQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-muted-foreground">Loading…</div>
    );
  }

  if (customerQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-destructive">
          {extractErrorMessage(customerQuery.error, "Failed to load customer")}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link to="/customers">← Customers</Link>
        </Button>
        {savedMessage && (
          <span className="text-sm text-muted-foreground">{savedMessage}</span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {customerQuery.data?.first_name} {customerQuery.data?.last_name}
          </CardTitle>
          <CardDescription>
            Customer since{" "}
            {customerQuery.data
              ? new Date(customerQuery.data.created_at).toLocaleDateString()
              : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {extractErrorMessage(mutation.error, "Save failed")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm(initial)}
                disabled={!hasChanges || mutation.isPending}
              >
                Discard changes
              </Button>
              <Button type="submit" disabled={!hasChanges || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
