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

1. Generate Text
2. Generate All Images
3. Edit each pin's **Pin URL** and **Pinterest board name**
4. Click **Create CSV** to download `pinterest-pins-export.csv`

## CSV export details

- Columns (exact order):
  `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`
- Media URLs are public links uploaded during image generation (not base64/blob/local paths).
- Schedule strategy in UTC:
  - Pin 1: immediate (`""`)
  - Pin 2: now + 5 days
  - Pin 3: now + 10 days
  - Pin 4: now + 17 days
  - Pin 5: now + 24 days
- Dates formatted as `YYYY-MM-DDTHH:MM:SS`.
