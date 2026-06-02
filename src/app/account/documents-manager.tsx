"use client";

import { useMemo, useRef, useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { ChevronRightIcon } from "~/components/ui/icons";
import { Label } from "~/components/ui/label";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api, type RouterOutputs } from "~/trpc/react";

type ChecklistItem =
  RouterOutputs["documentChecklist"]["bySession"]["data"][number];

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  uploaded: "bg-sky-100 text-sky-700",
  missing: "bg-slate-100 text-slate-600",
};

export function DocumentsManager({ sessionId }: { sessionId: string }) {
  const { locale, t } = useI18n();
  const utils = api.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  // A second, hidden input drives per-requirement uploads: clicking a
  // requirement's "Upload" stamps its document type here, then opens the picker.
  const reqFileRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<string | null>(null);
  const [docTypeId, setDocTypeId] = useState<string>("");

  const statusLabel: Record<string, string> = {
    verified: t.account.docs.statusVerified,
    uploaded: t.account.docs.statusUploaded,
    missing: t.account.docs.statusMissing,
  };

  const checklist = api.documentChecklist.bySession.useQuery({
    session_id: sessionId,
    language_code: locale,
  });
  const uploads = api.documentUpload.list.useQuery({ session_id: sessionId });
  const docTypes = api.documentType.list.useQuery({ language_code: locale });

  const generate = api.documentChecklist.generate.useMutation({
    onSuccess: () =>
      void utils.documentChecklist.bySession.invalidate({
        session_id: sessionId,
      }),
  });

  const createUpload = api.documentUpload.create.useMutation({
    onSuccess: () => {
      if (fileRef.current) fileRef.current.value = "";
      setDocTypeId("");
      void utils.documentUpload.list.invalidate({ session_id: sessionId });
      void utils.documentChecklist.bySession.invalidate({
        session_id: sessionId,
      });
    },
  });

  const deleteUpload = api.documentUpload.delete.useMutation({
    onSuccess: () => {
      void utils.documentUpload.list.invalidate({ session_id: sessionId });
      void utils.documentChecklist.bySession.invalidate({
        session_id: sessionId,
      });
    },
  });

  function handleAdd() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    createUpload.mutate({
      session_id: sessionId,
      file_name: file.name,
      file_mime_type: file.type || "application/octet-stream",
      size: file.size,
      document_type_id: docTypeId || undefined,
    });
  }

  // Upload straight against a checklist requirement. The upload is tagged with
  // that document type, so on success every program needing the same type flips
  // out of "missing" at once (status is derived per type, not per program).
  function handleRequirementUpload(documentTypeId: string) {
    pendingTypeRef.current = documentTypeId;
    reqFileRef.current?.click();
  }

  function handleReqFileChange() {
    const file = reqFileRef.current?.files?.[0];
    const documentTypeId = pendingTypeRef.current;
    if (file && documentTypeId) {
      createUpload.mutate({
        session_id: sessionId,
        file_name: file.name,
        file_mime_type: file.type || "application/octet-stream",
        size: file.size,
        document_type_id: documentTypeId,
      });
    }
    if (reqFileRef.current) reqFileRef.current.value = "";
    pendingTypeRef.current = null;
  }

  const items = checklist.data?.data ?? [];

  // Group required documents by the program that requires them; each program
  // renders as a collapsible section. Items with no program (program_id null)
  // collect into an "Other documents" bucket.
  const groups = useMemo(() => {
    const byProgram = new Map<
      string,
      { id: string | null; name: string; items: ChecklistItem[] }
    >();
    for (const item of items) {
      const key = item.program?.id ?? "__other__";
      let group = byProgram.get(key);
      if (!group) {
        group = {
          id: item.program?.id ?? null,
          name: item.program?.name ?? t.account.docs.otherProgram,
          items: [],
        };
        byProgram.set(key, group);
      }
      group.items.push(item);
    }
    return [...byProgram.values()];
  }, [items, t.account.docs.otherProgram]);

  // document_type_id -> the distinct program names that require it, so a shared
  // document can advertise the other programs it also satisfies.
  const programsByDocType = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      if (!item.program) continue;
      const names = map.get(item.document_type.id) ?? [];
      if (!names.includes(item.program.name)) names.push(item.program.name);
      map.set(item.document_type.id, names);
    }
    return map;
  }, [items]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        {/* Checklist */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {t.account.docs.requiredTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.account.docs.requiredDesc}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ session_id: sessionId })}
          >
            {generate.isPending
              ? t.account.docs.refreshing
              : t.account.docs.refresh}
          </Button>
        </div>

        {/* Hidden input shared by every requirement's inline "Upload" button. */}
        <input
          ref={reqFileRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf,image/heic"
          className="hidden"
          onChange={handleReqFileChange}
        />

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
            {t.account.docs.none}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((group) => {
              const done = group.items.filter(
                (i) => i.upload_status !== "missing",
              ).length;
              return (
                <details
                  key={group.id ?? "__other__"}
                  open
                  className="group rounded-lg border bg-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-1.5">
                      <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      {group.name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {fmt(t.account.docs.programReady, {
                        done,
                        total: group.items.length,
                      })}
                    </span>
                  </summary>
                  <ul className="flex flex-col gap-1.5 border-t px-3 py-2.5">
                    {group.items.map((item) => {
                      const shared = (
                        programsByDocType.get(item.document_type.id) ?? []
                      ).filter((name) => name !== group.name);
                      return (
                        <li
                          key={item.id}
                          className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{item.document_type.name}</span>
                            <div className="flex items-center gap-2">
                              {item.upload_status === "missing" && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={createUpload.isPending}
                                  onClick={() =>
                                    handleRequirementUpload(
                                      item.document_type.id,
                                    )
                                  }
                                >
                                  {t.account.docs.uploadDoc}
                                </Button>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  STATUS_STYLES[item.upload_status] ??
                                  STATUS_STYLES.missing
                                }`}
                              >
                                {statusLabel[item.upload_status] ??
                                  item.upload_status}
                              </span>
                            </div>
                          </div>
                          {shared.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {fmt(t.account.docs.alsoCounts, {
                                programs: shared.join(", "),
                              })}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        )}

        {/* Uploader */}
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <Label className="text-sm font-medium">
            {t.account.docs.uploadTitle}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={docTypeId}
              onChange={(e) => setDocTypeId(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t.account.docs.docTypeOptional}</option>
              {(docTypes.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf,image/heic"
              className="text-sm file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-sm"
            />
            <Button size="sm" onClick={handleAdd} disabled={createUpload.isPending}>
              {createUpload.isPending ? t.account.docs.adding : t.account.docs.add}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.account.docs.accepted}
          </p>
          {createUpload.error && (
            <Alert variant="error">{createUpload.error.message}</Alert>
          )}
        </div>

        {/* Uploaded files */}
        {(uploads.data?.data.length ?? 0) > 0 && (
          <ul className="flex flex-col gap-1.5">
            {uploads.data!.data.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="truncate">{u.file_name}</span>
                <ConfirmButton
                  size="xs"
                  variant="destructive"
                  confirmVariant="destructive"
                  title={t.account.docs.removeConfirmTitle}
                  description={fmt(t.account.docs.removeConfirmDesc, {
                    file: u.file_name,
                  })}
                  confirmLabel={t.account.docs.remove}
                  disabled={deleteUpload.isPending}
                  onConfirm={() =>
                    deleteUpload.mutateAsync({ session_id: sessionId, id: u.id })
                  }
                >
                  {t.account.docs.remove}
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
