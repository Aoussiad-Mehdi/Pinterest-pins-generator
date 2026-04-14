import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type Pin = {
  keyword: string;
  image_url: string;
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

const extractMetadata = (rawText: string) => {
  try {
    const parsed = JSON.parse(rawText) as {
      pinterest_title?: string;
      pinterest_description?: string;
      alt_text?: string;
    };

    return {
      pinterest_title: (parsed.pinterest_title || '').slice(0, 100),
      pinterest_description: (parsed.pinterest_description || '').slice(0, 500),
      alt_text: parsed.alt_text || ''
    };
  } catch {
    throw new Error('Text model did not return valid JSON.');
  }
};

const generatePinForKeyword = async (keyword: string): Promise<Pin> => {
  const metadataPrompt = METADATA_PROMPT.replace('[KEYWORD]', keyword);
  const metadataResponse = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: metadataPrompt,
    text: {
      format: {
        type: 'json_schema',
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
    }
  });

  const metadataRaw = metadataResponse.output_text;
  const metadata = extractMetadata(metadataRaw);

  const imagePrompt = IMAGE_PROMPT.replaceAll('[target keyword]', keyword);
  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: imagePrompt,
    size: '1080x1920'
  });

  const imageBase64 = imageResponse.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`Image generation failed for keyword: ${keyword}`);
  }

  return {
    keyword,
    image_url: `data:image/png;base64,${imageBase64}`,
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

    const pins = await Promise.all(keywords.map((keyword) => generatePinForKeyword(keyword)));

    return NextResponse.json({ pins });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate pins.' }, { status: 500 });
  }
}
