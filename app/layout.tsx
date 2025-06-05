import './globals.css';
import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}