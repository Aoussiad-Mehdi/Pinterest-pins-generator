'use client';

import { FormEvent, useMemo, useState } from 'react';

type PinResult = {
  keyword: string;
  image_url?: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
  custom_prompt?: string;
  brand_url?: string;
};

const EMPTY_KEYWORDS = ['', '', '', '', ''];

export default function HomePage() {
  const [keywords, setKeywords] = useState<string[]>(EMPTY_KEYWORDS);
  const [loadingText, setLoadingText] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [pins, setPins] = useState<PinResult[]>([]);

  const hasTextReady = useMemo(() => pins.length > 0, [pins]);

  const setKeyword = (index: number, value: string) => {
    setKeywords((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const setCustomPrompt = (index: number, value: string) => {
    setPins((prev) => prev.map((pin, i) => (i === index ? { ...pin, custom_prompt: value } : pin)));
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError('Copy failed. Please copy manually.');
    }
  };

  const handleGenerateText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const cleanKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (cleanKeywords.length < 1) {
      setError('Please add at least 1 keyword.');
      return;
    }

    setLoadingText(true);
    setPins([]);

    try {
      const response = await fetch('/api/generate-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: cleanKeywords })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate text.');
      }

      setPins((payload as { pins: PinResult[] }).pins || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setLoadingText(false);
    }
  };

  const requestImages = async (pinsPayload: PinResult[]) => {
    const response = await fetch('/api/generate-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pins: pinsPayload })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to generate images.');
    }

    return (payload as { pins: PinResult[] }).pins || [];
  };

  const handleGenerateImages = async () => {
    setError('');
    if (!pins.length) {
      setError('Generate text first.');
      return;
    }

    setLoadingImages(true);
    try {
      const nextPins = await requestImages(pins);
      setPins(nextPins);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleRegenerateImage = async (index: number) => {
    setError('');
    setRegeneratingIndex(index);

    try {
      const target = pins[index];
      if (!target) {
        throw new Error('Pin not found.');
      }

      const result = await requestImages([target]);
      if (!result[0]) {
        throw new Error('No regenerated image returned.');
      }

      setPins((prev) => prev.map((pin, i) => (i === index ? { ...pin, ...result[0] } : pin)));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleDownload = (imageUrl: string, keyword: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${keyword.replace(/\s+/g, '-').toLowerCase()}-pin.png`;
    link.click();
  };

  return (
    <main>
      <h1>Pinterest Pin Generator</h1>
      <p>Add 1 to 5 keywords. Generate text first, then generate all images.</p>

      <form onSubmit={handleGenerateText}>
        <div className="form-grid">
          {keywords.map((keyword, index) => (
            <input
              key={index}
              type="text"
              value={keyword}
              placeholder={`Keyword ${index + 1}${index === 0 ? ' (required)' : ' (optional)'}`}
              onChange={(event) => setKeyword(index, event.target.value)}
              maxLength={100}
              required={index === 0}
            />
          ))}
        </div>
        <button type="submit" disabled={loadingText || loadingImages}>
          {loadingText ? 'Generating Text...' : 'Generate Text'}
        </button>
      </form>

      {hasTextReady ? (
        <button type="button" disabled={loadingImages || loadingText} onClick={handleGenerateImages}>
          {loadingImages ? 'Generating Images...' : 'Generate All Images'}
        </button>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <section className="results">
        {pins.map((pin, index) => (
          <article className="card" key={`${pin.keyword}-${index}`}>
            {pin.image_url ? (
              <img src={pin.image_url} alt={pin.alt_text} loading="lazy" />
            ) : (
              <div className="placeholder">Image not generated yet</div>
            )}
            <h3>{pin.pinterest_title}</h3>
            <p>{pin.pinterest_description}</p>
            <p className="alt">
              <strong>Alt text:</strong> {pin.alt_text}
            </p>
            <p className="brand">
              <strong>Brand:</strong> {pin.brand_url || 'mehdiaoussiad.com/blog'}
            </p>

            <div className="copy-row">
              <button type="button" onClick={() => copyText(pin.pinterest_title)}>
                Copy Title
              </button>
              <button type="button" onClick={() => copyText(pin.pinterest_description)}>
                Copy Description
              </button>
            </div>

            <input
              type="text"
              placeholder="Custom image prompt (optional)"
              value={pin.custom_prompt || ''}
              onChange={(event) => setCustomPrompt(index, event.target.value)}
            />

            <div className="copy-row">
              <button
                type="button"
                disabled={loadingImages || regeneratingIndex === index}
                onClick={() => handleRegenerateImage(index)}
              >
                {regeneratingIndex === index ? 'Regenerating...' : 'Regenerate Image'}
              </button>
              <button
                type="button"
                disabled={!pin.image_url}
                onClick={() => pin.image_url && handleDownload(pin.image_url, pin.keyword)}
              >
                Download
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
