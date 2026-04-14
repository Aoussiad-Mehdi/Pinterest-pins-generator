import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type PinText = {
  keyword: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const METADATA_PROMPT = `You write Pinterest SEO copy for an art blog.
Use simple language, active voice, clean punctuation.
Rules:
- Title must include the exact target keyword.
- Title max 100 chars.
- Description max 500 chars.
- Alt text must be exact keyword.
Return JSON: {"items":[{"keyword":"","pinterest_title":"","pinterest_description":"","alt_text":""}]}.
Keywords:`;

const normalizeKeywords = (keywords: string[]) =>
  keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);

const ensureKeywordInTitle = (title: string, keyword: string) => {
  if (title.toLowerCase().includes(keyword.toLowerCase())) {
    return title.slice(0, 100);
  }

  return `${keyword}: ${title}`.slice(0, 100);
};

const generateAllMetadata = async (keywords: string[]): Promise<PinText[]> => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 900,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'pins_metadata_list',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  keyword: { type: 'string' },
                  pinterest_title: { type: 'string', maxLength: 100 },
                  pinterest_description: { type: 'string', maxLength: 500 },
                  alt_text: { type: 'string' }
                },
                required: ['keyword', 'pinterest_title', 'pinterest_description', 'alt_text']
              }
            }
          },
          required: ['items']
        }
      }
    },
    messages: [{ role: 'user', content: `${METADATA_PROMPT}\n${JSON.stringify(keywords)}` }]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No metadata returned.');
  }

  const parsed = JSON.parse(content) as { items: PinText[] };

  return keywords.map((keyword) => {
    const hit = parsed.items.find((item) => item.keyword.trim().toLowerCase() === keyword.toLowerCase());

    const fallbackTitle = `${keyword}: Creative Art Ideas`;
    const fallbackDescription = `Explore ${keyword} ideas for your next art project. Get clear tips and quick inspiration.`;

    return {
      keyword,
      pinterest_title: ensureKeywordInTitle(hit?.pinterest_title || fallbackTitle, keyword),
      pinterest_description: (hit?.pinterest_description || fallbackDescription).slice(0, 500),
      alt_text: keyword
    };
  });
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    const body = (await request.json()) as { keywords?: string[] };
    const keywords = normalizeKeywords(body.keywords || []);

    if (keywords.length < 1) {
      return NextResponse.json({ error: 'Please provide at least 1 keyword.' }, { status: 400 });
    }

    const pins = await generateAllMetadata(keywords);
    return NextResponse.json({ pins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate text: ${message}` }, { status: 500 });
  }
}
