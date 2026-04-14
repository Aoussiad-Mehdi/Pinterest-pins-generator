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

    const cleanKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);

    if (cleanKeywords.length < 1) {
      setError('Please add at least 1 keyword.');
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate pins.');
      }

      setPins((payload as { pins: PinResult[] }).pins || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error');
    } finally {
      setLoading(false);
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
      <p>Add 1 to 5 keywords. Pins generated = number of keywords entered.</p>

      <form onSubmit={handleGenerate}>
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
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Pins'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="results">
        {pins.map((pin, index) => (
          <article className="card" key={`${pin.keyword}-${index}`}>
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
