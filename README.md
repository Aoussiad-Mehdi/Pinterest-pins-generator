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
- Media URLs prefer direct public URLs from the image API; if unavailable, the app uploads base64 images via fallback hosts (0x0.st, catbox.moe, tmpfiles.org).
- Schedule strategy in UTC:
  - Pin 1: immediate (`""`)
  - Pin 2: now + 5 days
  - Pin 3: now + 10 days
  - Pin 4: now + 17 days
  - Pin 5: now + 24 days
- Dates formatted as `YYYY-MM-DDTHH:MM:SS`.

- Image generation settings:
  - model: `gpt-image-1`
  - quality: `medium`
  - size: `1024x1536` (2:3 vertical)
  - default prompt matches the original app prompt provided at project start
  - optional custom prompt is used exactly as entered
  - avoids unnecessary image API calls by reusing existing public media URLs unless regeneration is requested

- Keywords field:
  - AI generates relevant search keywords for each pin
  - exported as a comma-separated list in CSV


## Rate-limit protection

- Image requests are processed sequentially (no parallel image generation in one batch).
- The API waits 12-15 seconds between image requests.
- On 429 errors, automatic retries use exponential backoff starting at 15 seconds.
- A small in-memory queue is used; if full, new image batch requests are rejected with a clear message.
