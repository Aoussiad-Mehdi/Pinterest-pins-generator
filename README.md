# Pinterest Pin Generator

Simple Next.js app that generates Pinterest pins from user keywords using OpenAI.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env.local
   ```
3. Add your OpenAI API key to `.env.local`.
4. Run:
   ```bash
   npm run dev
   ```

## Workflow

1. Enter up to 5 keywords (comma-separated in one input, or use individual inputs)
2. Generate Text
3. Generate All Images
4. Edit each pin's **Pin URL** and **Pinterest board name**
5. Click **Create CSV** to download `pinterest-pins-export.csv`

## CSV export details

- Columns (exact order):
  `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`
- Media URLs are public links uploaded during image generation (primary: 0x0.st, fallbacks: catbox.moe and tmpfiles.org; never base64/blob/local paths).
- Schedule strategy in UTC:
  - Pin 1: immediate (`""`)
  - Pin 2: now + 5 days
  - Pin 3: now + 10 days
  - Pin 4: now + 17 days
  - Pin 5: now + 24 days
- Dates formatted as `YYYY-MM-DDTHH:MM:SS`.

- Image generation quality/cost balance:
  - model: `gpt-image-1`
  - quality: `medium`
  - size: `1024x1536` (2:3 vertical canvas, aligned to ~1000x1500 target)
  - prompts enforce vibrant contrast and graphic-design best practices for art pins

- Keywords field:
  - AI generates relevant search keywords for each pin
  - exported as a comma-separated list in CSV
