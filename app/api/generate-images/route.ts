import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type PinImageInput = {
  keyword: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IMAGE_PROMPT = (keyword: string) =>
  `Pinterest pin art niche: ${keyword}. Center bold text exactly '${keyword}'. Clean minimal, strong contrast, eye-catching.`;

const generateImage = async (keyword: string): Promise<string> => {
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: IMAGE_PROMPT(keyword),
    size: '1024x1536',
    quality: 'low'
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

    const body = (await request.json()) as { pins?: PinImageInput[] };
    const pins = (body.pins || []).filter((pin) => pin.keyword?.trim()).slice(0, 5);

    if (pins.length < 1) {
      return NextResponse.json({ error: 'Please provide at least 1 pin text payload.' }, { status: 400 });
    }

    const images = await Promise.all(pins.map((pin) => generateImage(pin.keyword.trim())));

    const completedPins = pins.map((pin, index) => ({
      ...pin,
      alt_text: pin.keyword,
      image_url: images[index]
    }));

    return NextResponse.json({ pins: completedPins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate images: ${message}` }, { status: 500 });
  }
}
