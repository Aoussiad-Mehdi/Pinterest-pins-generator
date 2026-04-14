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
- Two-step flow:
  1. Generate Text (single metadata request for all keywords)
  2. Generate All Images (parallel image requests with `Promise.all`)
- SEO copy rules:
  - simple language, active voice, clean punctuation
  - title includes exact keyword
  - alt text equals exact keyword
- Image controls:
  - eye-catching vibrant style with brand URL at bottom (`mehdiaoussiad.com/blog`)
  - optional custom prompt per pin
  - regenerate image per pin
- Utilities:
  - copy title
  - copy description
  - download image
