import { NextResponse } from "next/server";
import { getAccessState, registerAnalyzeUsage } from "@/lib/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecommendationLevel = "kaufen" | "beobachten" | "warten";

type FrontendAnalysisResult = {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  detectedPrice: number;
  currency: string;
  score: number;
  summary: string;
  recommendation: {
    level: RecommendationLevel;
    text: string;
    reason: string;
  };
  priceRating?: string;
  positives?: string[];
  negatives?: string[];
  confidence?: string;
};

function fileToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text ? text : undefined;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeScore(value: unknown): number {
  const score = Math.round(normalizeNumber(value, 0));
  return Math.min(100, Math.max(0, score));
}

function normalizeCurrency(value: unknown): string {
  const currency = normalizeText(value, "EUR").toUpperCase();
  return currency.length === 3 ? currency : "EUR";
}

function normalizeRecommendationLevel(value: unknown): RecommendationLevel {
  const level = normalizeText(value).toLowerCase();

  if (level === "kaufen") return "kaufen";
  if (level === "beobachten") return "beobachten";
  if (level === "warten") return "warten";

  return "beobachten";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function runImageAnalysis(
  base64Image: string,
  mimeType: string
): Promise<FrontendAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }

  const prompt = `
Du analysierst einen hochgeladenen Screenshot oder ein Produktbild für eine Deal-Check-App.

Ziel:
- Erkenne das konkrete Produkt so präzise wie möglich
- Lies den sichtbaren Preis aus dem Screenshot, wenn vorhanden
- Bewerte, ob das Angebot attraktiv wirkt
- Gib einen KI-Score von 0 bis 100
- Formuliere eine klare, kurze Einschätzung auf Deutsch
- Antworte ausschließlich als JSON im vorgegebenen Schema

Wichtige Regeln:
- Wenn ein Preis sichtbar ist, trage ihn als Zahl ein, z. B. 24.99
- Wenn kein Preis sicher erkennbar ist, setze detectedPrice auf 0
- currency in der Regel "EUR", falls nichts anderes klar erkennbar ist
- title soll der konkrete Produktname sein, nicht nur "Erkanntes Produkt"
- brand, model, category nur füllen, wenn sinnvoll erkennbar
- summary in 2 bis 4 Sätzen
- recommendation.level darf nur sein: "kaufen", "beobachten", "warten"
- recommendation.text soll kurz sein, z. B. "Kaufen", "Beobachten" oder "Lieber warten"
- recommendation.reason soll die Begründung in 1 bis 2 Sätzen liefern
- score soll eine ganzzahlige Einschätzung von 0 bis 100 sein
- Erfinde keine harten Fakten, wenn sie im Screenshot nicht erkennbar sind
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "deal_check_analysis_v2",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              brand: { type: "string" },
              model: { type: "string" },
              category: { type: "string" },
              detectedPrice: { type: "number" },
              currency: { type: "string" },
              score: { type: "number" },
              summary: { type: "string" },
              recommendation: {
                type: "object",
                additionalProperties: false,
                properties: {
                  level: {
                    type: "string",
                    enum: ["kaufen", "beobachten", "warten"],
                  },
                  text: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["level", "text", "reason"],
              },
              priceRating: { type: "string" },
              positives: {
                type: "array",
                items: { type: "string" },
              },
              negatives: {
                type: "array",
                items: { type: "string" },
              },
              confidence: { type: "string" },
            },
            required: [
              "title",
              "brand",
              "model",
              "category",
              "detectedPrice",
              "currency",
              "score",
              "summary",
              "recommendation",
              "priceRating",
              "positives",
              "negatives",
              "confidence",
            ],
          },
        },
      },
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("OPENAI RAW ERROR", raw);
    throw new Error(`OpenAI API Fehler: ${raw}`);
  }

  let parsedOuter: any;
  try {
    parsedOuter = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI-Antwort konnte nicht geparst werden.");
  }

  const contentText =
    parsedOuter?.output?.[0]?.content?.find(
      (item: any) => item.type === "output_text"
    )?.text ||
    parsedOuter?.output_text ||
    "";

  if (!contentText) {
    console.error("OPENAI EMPTY OUTPUT", parsedOuter);
    throw new Error("Leere Analyse-Antwort erhalten.");
  }

  let parsedInner: any;
  try {
    parsedInner = JSON.parse(contentText);
  } catch {
    console.error("OPENAI JSON PARSE ERROR", contentText);
    throw new Error("Analyse-JSON konnte nicht verarbeitet werden.");
  }

  const result: FrontendAnalysisResult = {
    title: normalizeText(parsedInner?.title, "Erkanntes Produkt"),
    brand: normalizeOptionalText(parsedInner?.brand),
    model: normalizeOptionalText(parsedInner?.model),
    category: normalizeOptionalText(parsedInner?.category),
    detectedPrice: normalizeNumber(parsedInner?.detectedPrice, 0),
    currency: normalizeCurrency(parsedInner?.currency),
    score: normalizeScore(parsedInner?.score),
    summary: normalizeText(parsedInner?.summary, "Keine Zusammenfassung verfügbar."),
    recommendation: {
      level: normalizeRecommendationLevel(parsedInner?.recommendation?.level),
      text: normalizeText(
        parsedInner?.recommendation?.text,
        "Beobachten"
      ),
      reason: normalizeText(
        parsedInner?.recommendation?.reason,
        "Noch keine Begründung vorhanden."
      ),
    },
    priceRating: normalizeOptionalText(parsedInner?.priceRating),
    positives: normalizeStringArray(parsedInner?.positives),
    negatives: normalizeStringArray(parsedInner?.negatives),
    confidence: normalizeOptionalText(parsedInner?.confidence),
  };

  return result;
}

export async function POST(req: Request) {
  try {
    const access = await getAccessState();

    console.log("ANALYZE DEBUG", {
      authenticated: access.authenticated,
      allowed: access.allowed,
      plan: access.plan,
      userId: access.userId,
      usage: access.usage,
      reason: access.reason || null,
    });

    if (!access.authenticated) {
      return NextResponse.json(
        {
          ok: false,
          error: access.reason || "Bitte logge dich ein.",
          authenticated: false,
          allowed: false,
          plan: access.plan,
          usage: access.usage,
        },
        { status: 401 }
      );
    }

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: access.reason || "Upgrade erforderlich.",
          authenticated: true,
          allowed: false,
          plan: access.plan,
          usage: access.usage,
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Keine Datei hochgeladen.",
        },
        { status: 400 }
      );
    }

    const validMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bitte lade JPG, PNG oder WEBP hoch.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = fileToBase64(arrayBuffer);

    const analysis = await runImageAnalysis(base64Image, file.type);

    console.log("ANALYZE RESULT", {
      userId: access.userId,
      plan: access.plan,
      title: analysis.title,
      detectedPrice: analysis.detectedPrice,
      score: analysis.score,
      recommendation: analysis.recommendation?.text,
    });

    let usage = access.usage;
    let plan = access.plan;

    if (access.userId) {
      await registerAnalyzeUsage(access.userId);

      const refreshed = await getAccessState();
      usage = refreshed.usage;
      plan = refreshed.plan;
    }

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        allowed: true,
        plan,
        usage,
        result: analysis,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error("ANALYZE ROUTE ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unbekannter Fehler bei der Analyse.",
      },
      { status: 500 }
    );
  }
}