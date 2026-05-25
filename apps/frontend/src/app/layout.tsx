import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Olive — Chat & Inference Observability',
  description: 'LLM chatbot with a real-time inference logging and ingestion pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  );
}
