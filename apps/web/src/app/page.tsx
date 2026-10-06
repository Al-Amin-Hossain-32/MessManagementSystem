import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing-page';

export const metadata: Metadata = {
  title: 'MessManagement — Manage Your Mess Without the Mess',
  description: 'Manage members, meals, expenses and shared finances in one simple platform built for shared mess life.',
  openGraph: {
    title: 'MessManagement',
    description: 'Manage members, meals, expenses and shared finances in one simple platform.',
    type: 'website',
  },
};

export default function Page() {
  return <LandingPage />;
}
