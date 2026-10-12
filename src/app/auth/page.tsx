import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { Logo } from "@/components/logo";

export default function AuthPage() {
  return (
    <main className="flex flex-1 flex-col items-center bg-gradient-to-b from-accent-soft/60 to-canvas px-4 py-10">
      <Link href="/" aria-label="시작 화면으로" className="inline-flex min-h-11 items-center">
        <Logo />
      </Link>
      <Suspense fallback={null}>
        <AuthCard />
      </Suspense>
    </main>
  );
}
