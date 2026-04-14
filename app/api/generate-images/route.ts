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

// Balance quality + cost: use gpt-image-1 with medium quality for better text fidelity than low.
const IMAGE_MODEL = 'gpt-image-1';
const IMAGE_QUALITY: 'medium' = 'medium';
const IMAGE_SIZE = '1024x1024';

const defaultImagePrompt = (keyword: string) =>
  `Create a high-CTR Pinterest pin for art niche topic '${keyword}'. Use vivid colors, strong color contrast, clean typography, and clear visual hierarchy. Keep layout balanced with whitespace and a focal point. Center bold text exactly '${keyword}' with correct spelling. Add small brand text '${BRAND_URL}' at the bottom. Make it eye-catching and professional.`;

const buildImagePrompt = (pin: PinImageInput) => {
  if (!pin.custom_prompt?.trim()) {
    return defaultImagePrompt(pin.keyword);
  }

  return `${pin.custom_prompt.trim()} Apply graphic design best practices: strong contrast, visual hierarchy, clean spacing, readable typography, and vibrant colors. Ensure center text is exactly '${pin.keyword}' and add '${BRAND_URL}' at the bottom.`;
};

const uploadTo0x0 = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://0x0.st', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`0x0.st upload HTTP ${response.status}`);
  }

  return (await response.text()).trim();
};

const uploadToCatbox = async (file: File) => {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', file);

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`catbox upload HTTP ${response.status}`);
  }

  return (await response.text()).trim();
};


const uploadToTmpFiles = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`tmpfiles upload HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: { url?: string } };
  const pageUrl = payload.data?.url?.trim() || '';
  if (!pageUrl.startsWith('http://') && !pageUrl.startsWith('https://')) {
    throw new Error('tmpfiles upload returned invalid URL');
  }

  return pageUrl.replace('://tmpfiles.org/', '://tmpfiles.org/dl/');
};

const uploadToPublicStorage = async (base64Image: string, keyword: string): Promise<string> => {
  const fileBuffer = Buffer.from(base64Image, 'base64');
  const safeName = keyword.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'pin';
  const file = new File([fileBuffer], `${safeName}.png`, { type: 'image/png' });

  const attempts: Array<() => Promise<string>> = [() => uploadTo0x0(file), () => uploadToCatbox(file), () => uploadToTmpFiles(file)];

  let lastError = '';
  for (const attempt of attempts) {
    try {
      const uploadedUrl = await attempt();
      if (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')) {
        return uploadedUrl;
      }
      lastError = `Invalid upload URL returned: ${uploadedUrl}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown upload error';
    }
  }

  throw new Error(`Public upload failed for keyword: ${keyword}. Last error: ${lastError}`);
};

const generateImage = async (pin: PinImageInput): Promise<string> => {
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: buildImagePrompt(pin),
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY
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
