'use client';

import { FormEvent, useMemo, useState } from 'react';

type PinResult = {
  id: string;
  keyword: string;
  title: string;
  description: string;
  keywords: string[] | string;
  mediaUrl: string;
  pinUrl: string;
  boardName: string;
  image_url?: string;
  pinterest_title?: string;
  pinterest_description?: string;
  alt_text: string;
  custom_prompt?: string;
  brand_url?: string;
};

const EMPTY_KEYWORDS = ['', '', '', '', ''];
const CSV_COLUMNS = ['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords'];

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const formatPinterestDate = (date: Date) => date.toISOString().slice(0, 19);

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

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

  const updatePinField = (index: number, field: keyof PinResult, value: string) => {
    setPins((prev) => prev.map((pin, i) => (i === index ? { ...pin, [field]: value } : pin)));
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError('Copy failed. Please copy manually.');
    }
  };

  const mapTextPins = (rawPins: Array<{ keyword: string; pinterest_title: string; pinterest_description: string; alt_text: string }>): PinResult[] =>
    rawPins.map((pin, index) => ({
      id: `${pin.keyword}-${index + 1}`,
      keyword: pin.keyword,
      title: pin.pinterest_title,
      description: pin.pinterest_description,
      keywords: [pin.keyword],
      mediaUrl: '',
      pinUrl: '',
      boardName: '',
      alt_text: pin.alt_text,
      pinterest_title: pin.pinterest_title,
      pinterest_description: pin.pinterest_description,
      image_url: ''
    }));

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

      const rawPins = (payload as { pins: Array<{ keyword: string; pinterest_title: string; pinterest_description: string; alt_text: string }> }).pins || [];
      setPins(mapTextPins(rawPins));
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
      body: JSON.stringify({
        pins: pinsPayload.map((pin) => ({
          id: pin.id,
          keyword: pin.keyword,
          pinterest_title: pin.title,
          pinterest_description: pin.description,
          alt_text: pin.alt_text,
          custom_prompt: pin.custom_prompt,
          pinUrl: pin.pinUrl,
          boardName: pin.boardName,
          keywords: pin.keywords
        }))
      })
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

  const validatePinsForCsv = (items: PinResult[]) => {
    if (items.length !== 5) {
      throw new Error('CSV export requires exactly 5 pins.');
    }

    items.forEach((pin, index) => {
      if (!pin.title.trim()) {
        throw new Error(`Pin ${index + 1}: title is required.`);
      }
      if (!pin.mediaUrl.trim()) {
        throw new Error(`Pin ${index + 1}: media URL is required.`);
      }
      if (!/^https?:\/\//i.test(pin.mediaUrl.trim())) {
        throw new Error(`Pin ${index + 1}: media URL must start with http:// or https://.`);
      }
      if (!pin.boardName.trim()) {
        throw new Error(`Pin ${index + 1}: board name is required.`);
      }
    });
  };

  const handleCreateCsv = () => {
    setError('');

    try {
      validatePinsForCsv(pins);

      const now = new Date();
      const publishDates = ['', formatPinterestDate(addDays(now, 5)), formatPinterestDate(addDays(now, 10)), formatPinterestDate(addDays(now, 17)), formatPinterestDate(addDays(now, 24))];

      const rows = pins.map((pin, index) => ({
        Title: pin.title.trim().slice(0, 100),
        'Media URL': pin.mediaUrl.trim(),
        'Pinterest board': pin.boardName.trim(),
        Thumbnail: '',
        Description: pin.description.trim().slice(0, 500),
        Link: pin.pinUrl.trim() || '',
        'Publish date': publishDates[index] || '',
        Keywords: Array.isArray(pin.keywords) ? pin.keywords.join(', ') : pin.keywords
      }));

      const csvHeader = CSV_COLUMNS.join(',');
      const csvBody = rows
        .map((row) =>
          CSV_COLUMNS.map((column) => escapeCsv(String(row[column as keyof typeof row] ?? ''))).join(',')
        )
        .join('\n');

      const csv = `\uFEFF${csvHeader}\n${csvBody}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pinterest-pins-export.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (csvError) {
      setError(csvError instanceof Error ? csvError.message : 'Failed to create CSV.');
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
          <article className="card" key={pin.id}>
            {pin.image_url ? <img src={pin.image_url} alt={pin.alt_text} loading="lazy" /> : <div className="placeholder">Image not generated yet</div>}

            <h3>{pin.title}</h3>
            <p>{pin.description}</p>
            <p className="alt">
              <strong>Keywords:</strong> {Array.isArray(pin.keywords) ? pin.keywords.join(', ') : pin.keywords}
            </p>
            <p className="alt">
              <strong>Media URL:</strong> {pin.mediaUrl || 'Generate images to get public media URL'}
            </p>

            <input
              type="url"
              placeholder="Pin URL (destination link)"
              value={pin.pinUrl}
              onChange={(event) => updatePinField(index, 'pinUrl', event.target.value)}
            />
            <input
              type="text"
              placeholder="Pinterest board name"
              value={pin.boardName}
              onChange={(event) => updatePinField(index, 'boardName', event.target.value)}
            />
            <input
              type="text"
              placeholder="Custom image prompt (optional)"
              value={pin.custom_prompt || ''}
              onChange={(event) => updatePinField(index, 'custom_prompt', event.target.value)}
            />

            <div className="copy-row">
              <button type="button" onClick={() => copyText(pin.title)}>
                Copy Title
              </button>
              <button type="button" onClick={() => copyText(pin.description)}>
                Copy Description
              </button>
            </div>

            <div className="copy-row">
              <button type="button" disabled={loadingImages || regeneratingIndex === index} onClick={() => handleRegenerateImage(index)}>
                {regeneratingIndex === index ? 'Regenerating...' : 'Regenerate Image'}
              </button>
              <button type="button" disabled={!pin.image_url} onClick={() => pin.image_url && handleDownload(pin.image_url, pin.keyword)}>
                Download
              </button>
            </div>
          </article>
        ))}
      </section>

      {pins.length > 0 ? (
        <button type="button" onClick={handleCreateCsv} disabled={loadingImages || loadingText || regeneratingIndex !== null}>
          Create CSV
        </button>
      ) : null}
    </main>
  );
}
