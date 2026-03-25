import ResultCard from "@/components/ResultCard";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const params = await searchParams;
  const raw = params.data;

  if (!raw) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-8 text-red-100">
          Keine Daten gefunden.
        </div>
      </main>
    );
  }

  const parsed = JSON.parse(decodeURIComponent(raw));

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <ResultCard analyzed={parsed.analyzed} compared={parsed.compared} />
    </main>
  );
}