import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';

const sulSans = localFont({
  src: '../public/fonts/SulSans-Bold.otf',
  variable: '--font-sul-sans'
});

export const metadata: Metadata = {
  title: 'Instagram Post Creator',
  description: 'Create and preview Instagram posts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sulSans.variable}`}>{children}</body>
    </html>
  );
}