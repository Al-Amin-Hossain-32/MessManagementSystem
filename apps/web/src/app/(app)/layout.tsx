'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { TopBar } from '@/components/shell';
import { Spinner } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'anon') router.replace('/login'); }, [status, router]);
  if (status !== 'authed') return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return (
    <>
      <TopBar />
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[90rem] px-4 py-5 sm:px-6 md:py-7 lg:px-8">
        {children}
      </main>
    </>
  );
}
