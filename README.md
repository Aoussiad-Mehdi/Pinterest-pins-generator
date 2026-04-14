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

## Features

- 5 keyword inputs (keyword #1 required, #2-#5 optional)
- Pins generated = number of keywords entered (1 to 5)
- Two-step flow for speed + cost control:
  1. Generate Text (single metadata request for all keywords)
  2. Generate All Images (parallel image requests with `Promise.all`)
- Cost/performance best practices:
  - concise prompts
  - low temperature for metadata consistency
  - token cap for metadata response
  - low image quality setting for lower cost
- Pin cards include image, title, description, exact-keyword alt text, and download button
