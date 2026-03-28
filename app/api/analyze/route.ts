import { NextResponse } from "next/server";
import { getAccessState, registerAnalyzeUsage } from "@/lib/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnalysisResult = {
  summary: string;
  recommendation:
    | "Kaufen"
    | "Eher kaufen"
    | "Beobachten"
    | "Eher nicht"
    | "Nicht kaufen";
  priceRating: string;
  positives: string[];
  negatives: string[];
  confidence: string;
};

function fileToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

async function runImageAnalysis(
  base64Image: string,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }

  const prompt = `
Du analysierst einen hochgeladenen Screenshot oder ein Produktbild für eine Deal-Check-App.

Ziel:
- Erkenne das Produkt / Angebot
- Schätze ein, ob der Preis attraktiv wirkt
- Gib eine klare Kaufempfehlung
- Antworte auf Deutsch
- Antworte ausschließlich als JSON

JSON-Schema:
{
  "summary": "kurze Zusammenfassung in 2-4 Sätzen",
  "recommendation": "Kaufen | Eher kaufen | Beobachten | Eher nicht | Nicht kaufen",
  "priceRating": "z. B. Sehr gut / Gut / Mittel / Eher teuer / Zu teuer",
  "positives": ["..."],
  "negatives": ["..."],
  "confidence": "z. B. hoch / mittel / niedrig"
}

Wichtig:
- Bleib vorsichtig, wenn wichtige Daten auf dem Screenshot fehlen.
- Erfinde keine technischen Fakten.
- Wenn Preis oder Zustand nicht klar sind, sag das offen.
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
          name: "deal_check_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              recommendation: {
                type: "string",
                enum: [
                  "Kaufen",
                  "Eher kaufen",
                  "Beobachten",
                  "Eher nicht",
                  "Nicht kaufen",
                ],
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

  try {
    return JSON.parse(contentText) as AnalysisResult;
  } catch {
    console.error("OPENAI JSON PARSE ERROR", contentText);
    throw new Error("Analyse-JSON konnte nicht verarbeitet werden.");
  }
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
      recommendation: analysis.recommendation,
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