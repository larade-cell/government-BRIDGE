"use client";

import { useRef, useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { Label } from "~/components/ui/label";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api } from "~/trpc/react";

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  uploaded: "bg-sky-100 text-sky-700",
  missing: "bg-slate-100 text-slate-600",
};

export function DocumentsManager({ sessionId }: { sessionId: string }) {
  const { locale, t } = useI18n();
  const utils = api.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
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

  const items = checklist.data?.data ?? [];

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

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
            {t.account.docs.none}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span>{item.document_type.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    STATUS_STYLES[item.upload_status] ?? STATUS_STYLES.missing
                  }`}
                >
                  {statusLabel[item.upload_status] ?? item.upload_status}
                </span>
              </li>
            ))}
          </ul>
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
