import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type PinText = {
  keyword: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const METADATA_PROMPT = `Write Pinterest SEO content for an art blog.
Use simple active voice.
Return JSON with items: keyword, pinterest_title(max100), pinterest_description(max500), alt_text(exact keyword).
Keywords:`;

const normalizeKeywords = (keywords: string[]) =>
  keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);

const generateAllMetadata = async (keywords: string[]): Promise<PinText[]> => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
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

    return {
      keyword,
      pinterest_title: (hit?.pinterest_title || keyword).slice(0, 100),
      pinterest_description:
        (hit?.pinterest_description || `Discover ${keyword} ideas, tips, and inspiration for your next art project.`).slice(0, 500),
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
