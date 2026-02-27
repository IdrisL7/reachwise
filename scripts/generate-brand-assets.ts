/**
 * One-shot script to generate temporary wordmark avatar/banner images
 * for X and LinkedIn profile setup.
 *
 * Usage: npx tsx scripts/generate-brand-assets.ts
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "public", "brand");
mkdirSync(OUTPUT_DIR, { recursive: true });

const BG_COLOR = "#FAFAFA";
const TEXT_COLOR = "#18181B";
const BRAND_NAME = "GetSignalHooks";

interface ImageSpec {
  filename: string;
  width: number;
  height: number;
  fontSize: number;
}

const specs: ImageSpec[] = [
  { filename: "avatar-400.png", width: 400, height: 400, fontSize: 36 },
  { filename: "avatar-300.png", width: 300, height: 300, fontSize: 28 },
  { filename: "banner-1128x191.png", width: 1128, height: 191, fontSize: 48 },
];

for (const spec of specs) {
  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, spec.width, spec.height);

  // Subtle border
  ctx.strokeStyle = "#E4E4E7";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, spec.width - 2, spec.height - 2);

  // Text
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `600 ${spec.fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(BRAND_NAME, spec.width / 2, spec.height / 2);

  const buffer = canvas.toBuffer("image/png");
  const outPath = join(OUTPUT_DIR, spec.filename);
  writeFileSync(outPath, buffer);
  console.log(`✓ ${spec.filename} (${spec.width}x${spec.height})`);
}

console.log(`\nAll images written to ${OUTPUT_DIR}`);
