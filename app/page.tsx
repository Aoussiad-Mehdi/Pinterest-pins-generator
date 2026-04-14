'use client';

import { FormEvent, useMemo, useState } from 'react';

type PinResult = {
  keyword: string;
  image_url?: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const EMPTY_KEYWORDS = ['', '', '', '', ''];

export default function HomePage() {
  const [keywords, setKeywords] = useState<string[]>(EMPTY_KEYWORDS);
  const [loadingText, setLoadingText] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState('');
  const [pins, setPins] = useState<PinResult[]>([]);

  const hasTextReady = useMemo(() => pins.length > 0, [pins]);

  const setKeyword = (index: number, value: string) => {
    setKeywords((prev) => prev.map((item, i) => (i === index ? value : item)));
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

  const handleGenerateImages = async () => {
    setError('');
    if (!pins.length) {
      setError('Generate text first.');
      return;
    }

    setLoadingImages(true);
    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate images.');
      }

      setPins((payload as { pins: PinResult[] }).pins || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setLoadingImages(false);
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
      <p>Add 1 to 5 keywords. First generate text, then click Generate All Images.</p>

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
            <button
              type="button"
              disabled={!pin.image_url}
              onClick={() => pin.image_url && handleDownload(pin.image_url, pin.keyword)}
            >
              Download
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
