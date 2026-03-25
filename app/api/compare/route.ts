import { NextResponse } from "next/server";
import type { AnalyzedProduct, PriceComparison } from "@/lib/types";
import { getSavingsPotential, rateDeal } from "@/lib/helpers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzedProduct;

    const lowestPrice = 239;
    const averagePrice = 249;
    const highestPrice = 279;

    const rating = rateDeal(body.detectedPrice, averagePrice);

    const response: PriceComparison = {
      lowestPrice,
      averagePrice,
      highestPrice,
      rating,
      savingsPotential: getSavingsPotential(body.detectedPrice, lowestPrice),
      sourceCount: 6,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json(
      { error: "Preisvergleich fehlgeschlagen" },
      { status: 500 }
    );
  }
}