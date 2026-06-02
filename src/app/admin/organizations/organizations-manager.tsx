"use client";

import { useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, type RouterOutputs } from "~/trpc/react";

type Org = RouterOutputs["organization"]["list"][number];
type Address = {
  line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
};

export function OrganizationsManager() {
  const utils = api.useUtils();
  const list = api.organization.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const remove = api.organization.delete.useMutation({
    onSuccess: () => void utils.organization.list.invalidate(),
  });

  const orgs = list.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
        >
          {creating ? "Cancel" : "New organization"}
        </Button>
      </div>

      {remove.error && <Alert variant="error">{remove.error.message}</Alert>}

      {creating && (
        <OrgForm
          onDone={() => {
            setCreating(false);
            void utils.organization.list.invalidate();
          }}
        />
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No organizations yet. Add partners residents can be referred to.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {orgs.map((o) => (
            <Card key={o.id} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {o.organization_type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[o.email, o.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </p>
                    {o.service_categories.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {o.service_categories.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setEditingId((cur) => (cur === o.id ? null : o.id))
                      }
                    >
                      {editingId === o.id ? "Close" : "Edit"}
                    </Button>
                    <ConfirmButton
                      size="xs"
                      variant="destructive"
                      confirmVariant="destructive"
                      title="Remove this organization?"
                      description={`"${o.name}" will be removed. This is blocked if any referrals point to it.`}
                      confirmLabel="Remove"
                      disabled={remove.isPending}
                      onConfirm={async () => {
                        // Swallow so the dialog closes; the error (e.g. still
                        // referenced) surfaces in the Alert above the list.
                        try {
                          await remove.mutateAsync({ id: o.id });
                        } catch {
                          /* shown via remove.error */
                        }
                      }}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                </div>
                {editingId === o.id && (
                  <OrgForm
                    org={o}
                    onDone={() => {
                      setEditingId(null);
                      void utils.organization.list.invalidate();
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgForm({ org, onDone }: { org?: Org; onDone: () => void }) {
  const isEdit = Boolean(org);
  const addr = (org?.address ?? {}) as Address;

  const [name, setName] = useState(org?.name ?? "");
  const [type, setType] = useState(org?.organization_type ?? "");
  const [phone, setPhone] = useState(org?.phone ?? "");
  const [email, setEmail] = useState(org?.email ?? "");
  const [website, setWebsite] = useState(org?.website_url ?? "");
  const [line1, setLine1] = useState(addr.line1 ?? "");
  const [city, setCity] = useState(addr.city ?? "");
  const [stateVal, setStateVal] = useState(addr.state ?? "");
  const [zip, setZip] = useState(addr.postal_code ?? "");
  const [categories, setCategories] = useState(
    (org?.service_categories ?? []).join(", "),
  );

  const create = api.organization.create.useMutation({ onSuccess: onDone });
  const update = api.organization.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function submit() {
    const trimmed = (v: string) => (v.trim() === "" ? null : v.trim());
    const address = {
      ...(line1.trim() && { line1: line1.trim() }),
      ...(city.trim() && { city: city.trim() }),
      ...(stateVal.trim() && { state: stateVal.trim() }),
      ...(zip.trim() && { postal_code: zip.trim() }),
    };
    const service_categories = categories
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const common = {
      name: name.trim(),
      organization_type: type.trim(),
      phone: trimmed(phone),
      email: trimmed(email),
      website_url: trimmed(website),
      service_categories,
      ...(Object.keys(address).length > 0 && { address }),
    };
    if (isEdit && org) update.mutate({ id: org.id, ...common });
    else create.mutate(common);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type (e.g. food_bank, legal_aid)">
          <Input value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Website URL">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="Service categories (comma-separated)">
          <Input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="food, housing, legal"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Address line">
          <Input value={line1} onChange={(e) => setLine1(e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="State">
          <Input value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
        </Field>
        <Field label="ZIP">
          <Input value={zip} onChange={(e) => setZip(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create organization"}
        </Button>
        {error && (
          <Alert variant="error" className="flex-1">
            {error.message}
          </Alert>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
