import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type Pin = {
  keyword: string;
  image_url: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

type Metadata = {
  keyword: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const METADATA_PROMPT = `Write Pinterest SEO content for an art blog.
Simple active voice.
For each keyword, return JSON array items:
keyword, pinterest_title(max100), pinterest_description(max500), alt_text(exact keyword).
Keywords:`;

const IMAGE_PROMPT = (keyword: string) =>
  `Pinterest pin for: ${keyword}. Center bold text exactly: ${keyword}. Minimal, high contrast, clean, unique style.`;

const normalizeKeywords = (keywords: string[]) =>
  keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);

const generateAllMetadata = async (keywords: string[]): Promise<Map<string, Metadata>> => {
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
    messages: [
      {
        role: 'user',
        content: `${METADATA_PROMPT}\n${JSON.stringify(keywords)}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No metadata returned.');
  }

  const parsed = JSON.parse(content) as { items: Metadata[] };
  const byKeyword = new Map<string, Metadata>();

  for (const keyword of keywords) {
    const hit = parsed.items.find((item) => item.keyword.trim().toLowerCase() === keyword.toLowerCase());
    byKeyword.set(keyword, {
      keyword,
      pinterest_title: (hit?.pinterest_title || keyword).slice(0, 100),
      pinterest_description:
        (hit?.pinterest_description || `Discover ${keyword} ideas, tips, and inspiration for your next art project.`).slice(0, 500),
      alt_text: keyword
    });
  }

  return byKeyword;
};

const generateImage = async (keyword: string): Promise<string> => {
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: IMAGE_PROMPT(keyword),
    size: '1024x1536'
  });

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image returned for keyword: ${keyword}`);
  }

  return `data:image/png;base64,${imageBase64}`;
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

    const metadataByKeyword = await generateAllMetadata(keywords);

    const imageUrls = await Promise.all(keywords.map((keyword) => generateImage(keyword)));

    const pins: Pin[] = keywords.map((keyword, index) => {
      const metadata = metadataByKeyword.get(keyword);
      return {
        keyword,
        image_url: imageUrls[index],
        pinterest_title: metadata?.pinterest_title || keyword,
        pinterest_description:
          metadata?.pinterest_description || `Discover ${keyword} ideas, tips, and inspiration for your next art project.`,
        alt_text: keyword
      };
    });

    return NextResponse.json({ pins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Pin generation failed:', message, error);
    return NextResponse.json({ error: `Failed to generate pins: ${message}` }, { status: 500 });
  }
}
