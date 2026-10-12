import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="text-muted">주소가 바뀌었거나 없는 페이지예요.</p>
      <Link href="/workspace" className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
        프로젝트 아카이브로
      </Link>
    </main>
  );
}
