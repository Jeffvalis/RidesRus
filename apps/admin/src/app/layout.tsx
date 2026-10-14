import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { SessionProvider } from '@/lib/session';
import './globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'RidesRus Fleet HQ',
  description: 'Live operations for the RidesRus bus network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${font.className} antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
