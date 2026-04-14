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
  mediaUrl?: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BRAND_URL = 'www.mehdiaoussiad.com';

const IMAGE_MODEL = 'gpt-image-1';
const IMAGE_QUALITY: 'medium' = 'medium';
const IMAGE_SIZE = '1024x1536';

const LAYOUT_STYLES = ['collage', 'sketchbook style', 'split layout', 'scrapbook style', 'editorial poster style'];

const isPublicHttpUrl = (value?: string) => !!value && /^https?:\/\//i.test(value.trim());

const defaultImagePrompt = (keyword: string, layoutStyle: string) =>
  `Design a Pinterest pin for keyword: ${keyword}. Do not use plain or empty color backgrounds. Create a visually rich artistic background related to the keyword using elements like drawings, sketches, watercolor textures, doodles, or art supplies. Use this layout style: ${layoutStyle}. Place exact keyword text '${keyword}' as large bold overlay in a clean readable area at top or center. Make the design eye-catching and artistic. Ensure strong readability and high contrast for the text. Keep it suitable for Pinterest vertical 9:16.`;

const buildImagePrompt = (pin: PinImageInput, layoutStyle: string) => {
  if (pin.custom_prompt?.trim()) {
    return pin.custom_prompt.trim();
  }

  return defaultImagePrompt(pin.keyword, layoutStyle);
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
  if (!isPublicHttpUrl(pageUrl)) {
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
      if (isPublicHttpUrl(uploadedUrl)) {
        return uploadedUrl;
      }
      lastError = `Invalid upload URL returned: ${uploadedUrl}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown upload error';
    }
  }

  throw new Error(`Public upload failed for keyword: ${keyword}. Last error: ${lastError}`);
};

const generateImage = async (pin: PinImageInput, index: number): Promise<string> => {
  const layoutStyle = LAYOUT_STYLES[index % LAYOUT_STYLES.length];
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: buildImagePrompt(pin, layoutStyle),
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY
  });

  const imageUrl = response.data?.[0]?.url;
  if (isPublicHttpUrl(imageUrl)) {
    return imageUrl;
  }

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`No image URL or base64 returned for keyword: ${pin.keyword}`);
  }

  return uploadToPublicStorage(imageBase64, pin.keyword);
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    const body = (await request.json()) as { pins?: PinImageInput[]; forceRegenerate?: boolean };
    const pins = (body.pins || []).filter((pin) => pin.keyword?.trim()).slice(0, 5);
    const forceRegenerate = !!body.forceRegenerate;

    if (pins.length < 1) {
      return NextResponse.json({ error: 'Please provide at least 1 pin text payload.' }, { status: 400 });
    }

    const mediaUrls = await Promise.all(
      pins.map((pin, index) => {
        if (!forceRegenerate && !pin.custom_prompt?.trim() && isPublicHttpUrl(pin.mediaUrl)) {
          return Promise.resolve(pin.mediaUrl!.trim());
        }
        return generateImage(pin, index);
      })
    );

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
