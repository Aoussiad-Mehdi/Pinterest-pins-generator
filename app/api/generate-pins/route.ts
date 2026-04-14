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
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const METADATA_PROMPT = `You are creating Pinterest pin content for an art blog.
Write in simple language.
Use active voice.
Make the content clear, clickable, and SEO optimized for Pinterest.

Target keyword: [KEYWORD]

Rules:

The Pinterest title must be SEO optimized
The Pinterest description must be SEO optimized
The alt text must be the exact target keyword
Keep the wording natural
Do not stuff keywords

Return JSON with:

pinterest_title, max 100 characters
pinterest_description, max 500 characters
alt_text`;

const IMAGE_PROMPT = `Design a good-looking Pinterest pin for this blog post: [target keyword]. Use bold and large text overlay in the center. text overlay is: [target keyword]. Use minimal design. Follow design best practices to get the best CTR.

Important rules:

The text overlay must be the exact keyword
Each pin design must be unique for each keyword
Keep the design clean and eye-catching
Make the layout suitable for Pinterest
Use 9:16 format
Use strong contrast so the text is easy to read`;

const parseMetadata = (content: string, keyword: string): Metadata => {
  const parsed = JSON.parse(content) as Partial<Metadata>;

  return {
    pinterest_title: (parsed.pinterest_title || keyword).slice(0, 100),
    pinterest_description: (parsed.pinterest_description || `Discover ${keyword} ideas for your next art project.`).slice(0, 500),
    alt_text: keyword
  };
};

const generateMetadata = async (keyword: string): Promise<Metadata> => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'pin_metadata',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pinterest_title: { type: 'string', maxLength: 100 },
            pinterest_description: { type: 'string', maxLength: 500 },
            alt_text: { type: 'string' }
          },
          required: ['pinterest_title', 'pinterest_description', 'alt_text']
        }
      }
    },
    messages: [
      {
        role: 'user',
        content: METADATA_PROMPT.replace('[KEYWORD]', keyword)
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`No metadata returned for keyword: ${keyword}`);
  }

  return parseMetadata(content, keyword);
};

const generateImage = async (keyword: string): Promise<string> => {
  const imagePrompt = IMAGE_PROMPT.replaceAll('[target keyword]', keyword);

  // gpt-image-1 currently supports 1024x1536 for portrait. We return this in 2:3 and render as pin cards.
  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: imagePrompt,
    size: '1024x1536'
  });

  const imageBase64 = imageResponse.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image returned for keyword: ${keyword}`);
  }

  return `data:image/png;base64,${imageBase64}`;
};

const generatePinForKeyword = async (keyword: string): Promise<Pin> => {
  const [metadata, image_url] = await Promise.all([generateMetadata(keyword), generateImage(keyword)]);

  return {
    keyword,
    image_url,
    pinterest_title: metadata.pinterest_title,
    pinterest_description: metadata.pinterest_description,
    alt_text: keyword
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { keywords?: string[] };
    const keywords = (body.keywords || []).map((keyword) => keyword.trim());

    if (keywords.length !== 5 || keywords.some((keyword) => !keyword)) {
      return NextResponse.json({ error: 'Please provide exactly 5 keywords.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    const pins: Pin[] = [];
    for (const keyword of keywords) {
      const pin = await generatePinForKeyword(keyword);
      pins.push(pin);
    }

    return NextResponse.json({ pins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Pin generation failed:', message, error);
    return NextResponse.json({ error: `Failed to generate pins: ${message}` }, { status: 500 });
  }
}
