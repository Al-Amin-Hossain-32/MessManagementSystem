import type { Metadata, Viewport } from 'next';
import { Anek_Bangla, Hind_Siliguri } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

// Two families with clearly different jobs: Anek Bangla for headings/numbers, Hind Siliguri for reading.
const head = Anek_Bangla({ subsets: ['bengali', 'latin'], variable: '--font-head', display: 'swap' });
const body = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'মেস ম্যানেজমেন্ট', template: '%s · মেস ম্যানেজমেন্ট' },
  description: 'Mess Management System',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0e5a48' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${head.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
