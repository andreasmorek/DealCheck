import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getUserFromAccessToken } from "@/lib/supabase/auth";

export const runtime = "nodejs";

/* =========================
   TYPES
========================= */

type ExtractedAnalyzeResult = {
  title: string;
  brand: string;
  model: string;
  category: string;
  detectedPrice: number;
  currency: string;
};

type RecommendationLevel = "kaufen" | "beobachten" | "warten";

type AnalyzeResponse = ExtractedAnalyzeResult & {
  score: number;
  recommendation: {
    level: RecommendationLevel;
    text: string;
    reason: string;
  };
  summary: string;
};

/* =========================
   HELPERS
========================= */

function extractTextFromResponse(parsed: any): string {
  if (typeof parsed?.output_text === "string" && parsed.output_text.trim()) {
    return parsed.output_text.trim();
  }

  const texts: string[] = [];

  if (Array.isArray(parsed?.output)) {
    for (const item of parsed.output) {
      if (!Array.isArray(item?.content)) continue;

      for (const contentItem of item.content) {
        if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
          texts.push(contentItem.text.trim());
        }
      }
    }
  }

  return texts.join("\n").trim();
}

function extractJson(text: string): ExtractedAnalyzeResult {
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Kein JSON gefunden. Modellantwort: ${cleaned.slice(0, 500)}`);
    }
    return JSON.parse(match[0]);
  }
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCurrency(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "EUR";
}

function normalizePrice(value: unknown): number {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const normalized = value
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:[,.]|$))/g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function normalizeResult(data: Partial<ExtractedAnalyzeResult>): ExtractedAnalyzeResult {
  return {
    title: normalizeText(data.title),
    brand: normalizeText(data.brand),
    model: normalizeText(data.model),
    category: normalizeText(data.category),
    detectedPrice: normalizePrice(data.detectedPrice),
    currency: normalizeCurrency(data.currency),
  };
}

function calculateScore(result: ExtractedAnalyzeResult): number {
  let score = 50;

  if (result.title) score += 10;
  if (result.brand) score += 10;
  if (result.model) score += 10;
  if (result.category) score += 5;
  if (result.detectedPrice > 0) score += 15;

  return Math.min(100, score);
}

function getRecommendation(score: number): AnalyzeResponse["recommendation"] {
  if (score >= 80) {
    return {
      level: "kaufen",
      text: "Kaufen",
      reason: "Sehr gutes Angebot.",
    };
  }

  if (score >= 60) {
    return {
      level: "beobachten",
      text: "Beobachten",
      reason: "Solides Angebot.",
    };
  }

  return {
    level: "warten",
    text: "Lieber warten",
    reason: "Kein guter Deal aktuell.",
  };
}

/* =========================
   MAIN ROUTE
========================= */

export async function POST(request: NextRequest) {
  try {
    console.log("ANALYZE START");

    /* ========= AUTH ========= */

    const authHeader = request.headers.get("authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    let userId: string | null = null;

    if (token) {
      try {
        const user = await getUserFromAccessToken(token);
        userId = user?.id ?? null;
      } catch (error) {
        console.warn("USER LOOKUP FAILED", error);
      }
    }

    /* ========= FILE ========= */

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    const mimeType = file.type || "image/png";
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    /* ========= OPENAI ========= */

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY fehlt auf dem Server." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `
Analysiere dieses Produktbild und gib ausschließlich gültiges JSON zurück.
Keine Einleitung, keine Erklärung, kein Markdown.

Erlaubtes Format:
{
  "title": "string",
  "brand": "string",
  "model": "string",
  "category": "string",
  "detectedPrice": number,
  "currency": "EUR"
}

Regeln:
- Nur JSON zurückgeben
- detectedPrice nur als Zahl ohne Währungssymbol
- Wenn etwas fehlt, leeren String verwenden
- currency standardmäßig "EUR"
                `.trim(),
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64}`,
              },
            ],
          },
        ],
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json({ error: raw }, { status: 500 });
    }

    const parsed = JSON.parse(raw);
    const text = extractTextFromResponse(parsed);

    if (!text) {
      return NextResponse.json(
        { error: "Keine auswertbare Modellantwort erhalten." },
        { status: 500 }
      );
    }

    const extracted = extractJson(text);
    const normalized = normalizeResult(extracted);

    const score = calculateScore(normalized);
    const recommendation = getRecommendation(score);

    const result: AnalyzeResponse = {
      ...normalized,
      score,
      recommendation,
      summary: `${normalized.title || "Produkt"}: ${recommendation.text}`,
    };

    /* ========= USAGE TRACKING ========= */

    if (userId) {
      const { error: usageInsertError } = await supabaseServer
        .from("analysis_usage")
        .insert({
          user_id: userId,
        });

      if (usageInsertError) {
        console.error("USAGE INSERT FAILED", usageInsertError);
      }
    }

    console.log("ANALYZE DONE", result);

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Analyse fehlgeschlagen",
      },
      { status: 500 }
    );
  }
}