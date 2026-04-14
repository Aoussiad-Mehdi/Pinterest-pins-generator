import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pinterest Pin Generator',
  description: 'Generate Pinterest pins from keywords with OpenAI'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
