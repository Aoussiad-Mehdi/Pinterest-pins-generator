# Pinterest Pin Generator

Simple Next.js app that generates 5 Pinterest pins from 5 keywords using OpenAI.

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

- 5 keyword inputs
- Generate Pins button
- 5 generated pin cards with:
  - 1080x1920 image (9:16)
  - Pinterest title
  - Pinterest description
  - Alt text = exact keyword
  - Download button
