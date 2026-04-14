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
- Fast generation strategy:
  - Metadata for all keywords in one text-model request
  - All images generated in parallel with `Promise.all`
- Pin cards include:
  - Generated image
  - Pinterest title
  - Pinterest description
  - Alt text = exact keyword
  - Download button
