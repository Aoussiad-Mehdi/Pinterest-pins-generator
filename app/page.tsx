'use client';

import { FormEvent, useState } from 'react';

type PinResult = {
  keyword: string;
  image_url: string;
  pinterest_title: string;
  pinterest_description: string;
  alt_text: string;
};

const EMPTY_KEYWORDS = ['', '', '', '', ''];

export default function HomePage() {
  const [keywords, setKeywords] = useState<string[]>(EMPTY_KEYWORDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pins, setPins] = useState<PinResult[]>([]);

  const setKeyword = (index: number, value: string) => {
    setKeywords((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const cleanKeywords = keywords.map((keyword) => keyword.trim());
    if (cleanKeywords.some((keyword) => !keyword)) {
      setError('Please fill all 5 keyword fields.');
      return;
    }

    setLoading(true);
    setPins([]);

    try {
      const response = await fetch('/api/generate-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: cleanKeywords })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to generate pins.');
      }

      const payload = (await response.json()) as { pins: PinResult[] };
      setPins(payload.pins);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (imageUrl: string, keyword: string) => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${keyword.replace(/\s+/g, '-').toLowerCase()}-pin.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <h1>Pinterest Pin Generator</h1>
      <p>Enter 5 keywords and generate 5 unique Pinterest pins.</p>

      <form onSubmit={handleGenerate}>
        <div className="form-grid">
          {keywords.map((keyword, index) => (
            <input
              key={index}
              type="text"
              value={keyword}
              placeholder={`Keyword ${index + 1}`}
              onChange={(event) => setKeyword(index, event.target.value)}
              maxLength={100}
              required
            />
          ))}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Pins'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="results">
        {pins.map((pin) => (
          <article className="card" key={pin.keyword}>
            <img src={pin.image_url} alt={pin.alt_text} loading="lazy" />
            <h3>{pin.pinterest_title}</h3>
            <p>{pin.pinterest_description}</p>
            <p className="alt">
              <strong>Alt text:</strong> {pin.alt_text}
            </p>
            <button type="button" onClick={() => handleDownload(pin.image_url, pin.keyword)}>
              Download
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
