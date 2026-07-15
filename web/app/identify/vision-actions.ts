"use server";

import Anthropic from "@anthropic-ai/sdk";
import { ALLOWED_MIME, MAX_BYTES } from "@/lib/photo-upload";
import { parseVisionExtraction, type VisionExtraction } from "@/lib/vision-extract";
import { COLOR_FAMILIES } from "@/lib/color-match";
import { getFunnelCategories } from "@/lib/wiki";

// Identify-MVP Phase 2 — pre-fills the funnel's shape/color picks from an
// uploaded photo so a beginner doesn't have to eyeball their own coral's
// colors. The photo is never persisted (no Storage write, no DB row) —
// same "purely visual, nothing sampled here is saved or submitted" contract
// as the existing personal PhotoColorSampler. Gated behind ANTHROPIC_API_KEY
// so the feature degrades to "not configured" rather than crashing when a
// key isn't set up (see docs/PROGRESS.md).
//
// Uses forced tool-use (not free-text JSON parsing) for reliable structured
// output, and every field is re-validated against known enums by
// parseVisionExtraction before it ever reaches the client — the model's
// response is untrusted input, same as any form submission.

const MODEL = process.env.ANTHROPIC_VISION_MODEL || "claude-haiku-4-5-20251001";

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_coral_traits",
  description: "Records the observed shape category, colors, and lighting of a coral photo.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "The coral's rough growth-form category, or \"unsure\" if the shape isn't clear.",
      },
      colors: {
        type: "array",
        description:
          "Every color family clearly visible on the coral itself (not the background/rock/water). Use only the listed family names.",
        items: { type: "string" },
      },
      approx_percents: {
        type: "object",
        description:
          "Optional rough visual percentage (0-100) of the coral's surface each reported color covers. Keys must match entries in `colors`; percentages don't need to sum to exactly 100.",
        additionalProperties: { type: "number" },
      },
      lighting: {
        type: "string",
        description:
          "The tank lighting the photo was taken under: \"daylight\" (white/neutral), \"actinic\" (blue/purple reef lighting, which shifts perceived color), \"mixed\", or \"unsure\".",
      },
    },
    required: ["category", "colors", "lighting"],
  },
};

export async function extractCoralTraitsFromPhoto(
  formData: FormData,
): Promise<{ error: string } | { result: VisionExtraction }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "AI photo assist isn't configured yet — pick the shape and colors manually below." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Only JPG, PNG, or WEBP images are supported." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image must be under 8MB." };
  }

  const categories = await getFunnelCategories();
  const categorySlugs = categories.map((c) => c.slug);
  const familyList = COLOR_FAMILIES.map((f) => `${f.code} (${f.label})`).join(", ");
  const categoryList = categories.map((c) => `${c.slug} (${c.name})`).join(", ") + ", unsure";

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");

  let response: Anthropic.Message;
  try {
    const client = new Anthropic({ apiKey });
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "record_coral_traits" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as "image/jpeg" | "image/png" | "image/webp",
                data: bytes,
              },
            },
            {
              type: "text",
              text:
                `Identify the coral in this photo for a reef-hobbyist identification tool.\n\n` +
                `Valid category values: ${categoryList}.\n` +
                `Valid color values: ${familyList}. Only report colors actually on the coral's tissue, not the rock, sand, water, or other corals in frame.\n\n` +
                `Call record_coral_traits with your best reading. If you're not confident about the shape, use "unsure" rather than guessing.`,
            },
          ],
        },
      ],
    });
  } catch {
    return { error: "Couldn't read that photo right now — try again, or pick manually below." };
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    return { error: "Couldn't make sense of that photo — try again, or pick manually below." };
  }

  const result = parseVisionExtraction(toolUse.input, categorySlugs);
  return { result };
}
