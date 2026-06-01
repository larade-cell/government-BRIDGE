import { CaseQueue } from "./case-queue";

export default function AdminCasesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Cases</h1>
        <p className="mt-1 text-muted-foreground">
          Caseworkers see cases assigned to them; admins see every case.
        </p>
      </div>
      <CaseQueue />
    </div>
  );
}
