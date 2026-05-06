import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { AttributionLog } from '../components/AttributionLog';
import './globals.css';

export const metadata: Metadata = {
  title: 'NextFlow',
  description: 'Workflow canvas and automation',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <AttributionLog />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
