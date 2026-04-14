import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type PinImageInput = {
  id?: string;
  keyword: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
  custom_prompt?: string;
  pinUrl?: string;
  boardName?: string;
  keywords?: string[] | string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BRAND_URL = 'mehdiaoussiad.com/blog';

const defaultImagePrompt = (keyword: string) =>
  `Create an eye-catching Pinterest pin for ${keyword}. Use vibrant colors, clean layout, and strong contrast. Center bold text exactly '${keyword}' with no spelling mistakes. Add small brand text '${BRAND_URL}' at the bottom. Make it professional and Pinterest-ready.`;

const buildImagePrompt = (pin: PinImageInput) => {
  if (!pin.custom_prompt?.trim()) {
    return defaultImagePrompt(pin.keyword);
  }

  return `${pin.custom_prompt.trim()} Ensure the exact center text is '${pin.keyword}', use vibrant colors, avoid mistakes, and add '${BRAND_URL}' at the bottom.`;
};

const uploadToPublicStorage = async (base64Image: string, keyword: string): Promise<string> => {
  const fileBuffer = Buffer.from(base64Image, 'base64');
  const file = new File([fileBuffer], `${keyword.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });

  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('https://0x0.st', {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error(`Public upload failed for keyword: ${keyword}`);
  }

  const uploadedUrl = (await uploadResponse.text()).trim();
  if (!uploadedUrl.startsWith('http://') && !uploadedUrl.startsWith('https://')) {
    throw new Error(`Public upload returned invalid URL for keyword: ${keyword}`);
  }

  return uploadedUrl;
};

const generateImage = async (pin: PinImageInput): Promise<string> => {
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: buildImagePrompt(pin),
    size: '1024x1536',
    quality: 'low'
  });

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image returned for keyword: ${pin.keyword}`);
  }

  return uploadToPublicStorage(imageBase64, pin.keyword);
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

    const mediaUrls = await Promise.all(pins.map((pin) => generateImage(pin)));

    const completedPins = pins.map((pin, index) => ({
      ...pin,
      id: pin.id || `${pin.keyword}-${index + 1}`,
      title: pin.pinterest_title,
      description: pin.pinterest_description,
      keywords: pin.keywords || [pin.keyword],
      mediaUrl: mediaUrls[index],
      image_url: mediaUrls[index],
      pinUrl: pin.pinUrl || '',
      boardName: pin.boardName || '',
      alt_text: pin.keyword,
      brand_url: BRAND_URL
    }));

    return NextResponse.json({ pins: completedPins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate images: ${message}` }, { status: 500 });
  }
}
