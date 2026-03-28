type Props = {
  rating: "good" | "fair" | "expensive";
  recommendationText?: string;
};

export default function DealBadge({ rating, recommendationText }: Props) {
  const config =
    rating === "good"
      ? {
          label: recommendationText || "Kaufen",
          classes:
            "border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]",
          dot: "bg-emerald-400",
        }
      : rating === "fair"
      ? {
          label: recommendationText || "Beobachten",
          classes:
            "border-amber-400/40 bg-amber-500/15 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
          dot: "bg-amber-400",
        }
      : {
          label: recommendationText || "Lieber warten",
          classes:
            "border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.18)]",
          dot: "bg-rose-400",
        };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold tracking-wide ${config.classes}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}