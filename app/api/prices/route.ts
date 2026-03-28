import { NextResponse } from "next/server";

type SerpShoppingItem = {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  link?: string;
  product_link?: string;
  serpapi_link?: string;
  thumbnail?: string;
};

function extractPrice(value: string | undefined, extracted?: number): number {
  if (typeof extracted === "number" && Number.isFinite(extracted)) {
    return extracted;
  }

  if (!value) return 0;

  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);

  return Number.isFinite(num) ? num : 0;
}

function normalizeLink(item: SerpShoppingItem): string {
  const candidates = [item.product_link, item.link, item.serpapi_link];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      return candidate;
    }
  }

  return "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!process.env.SERP_API_KEY) {
    return NextResponse.json(
      { error: "SERP_API_KEY fehlt" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(
        query
      )}&api_key=${process.env.SERP_API_KEY}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("SERP API HTTP ERROR:", res.status, text);

      return NextResponse.json(
        { error: "Preisabfrage fehlgeschlagen" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const rawResults: SerpShoppingItem[] = Array.isArray(data.shopping_results)
      ? data.shopping_results
      : [];

    const results = rawResults
      .map((item) => {
        const price = extractPrice(item.price, item.extracted_price);
        const link = normalizeLink(item);

        return {
          title: item.title || "Ohne Titel",
          price,
          shop: item.source || "Shop",
          link,
          image: item.thumbnail || "",
        };
      })
      .filter((item) => item.price > 0 && item.link);

    results.sort((a, b) => a.price - b.price);

    console.log("PRICE RESULTS:", results);

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (err) {
    console.error("PRICE API ERROR:", err);

    return NextResponse.json(
      { error: "Preisabfrage fehlgeschlagen" },
      { status: 500 }
    );
  }
}