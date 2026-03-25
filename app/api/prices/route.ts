import { NextResponse } from "next/server";

function extractPrice(value: string | undefined): number {
  if (!value) return 0;

  const cleaned = value
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");

  const num = parseFloat(cleaned);

  return Number.isFinite(num) ? num : 0;
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
      )}&api_key=${process.env.SERP_API_KEY}`
    );

    const data = await res.json();

    const rawResults = data.shopping_results || [];

    const results = rawResults
      .map((item: any) => {
        const price = extractPrice(item.price);

        return {
          title: item.title,
          price,
          shop: item.source || "Shop",
          link: item.link,
          image: item.thumbnail,
        };
      })
      // 🔥 WICHTIG: nur echte Preise behalten
      .filter((item: any) => item.price > 0);

    // sortieren
    results.sort((a: any, b: any) => a.price - b.price);

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