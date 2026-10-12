import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "개인정보 처리 안내 · portfolio_zip" };

const sections = [
  {
    t: "어떤 정보를 쓰나요?",
    items: [
      "Google 로그인으로 받는 계정 정보: 이름과 이메일 주소",
      "사용자가 직접 입력한 경험 기록, 업로드한 이미지, 포트폴리오 내용",
      "서비스 사용 기록: 어떤 기능을 썼는지만 남기고, 입력한 내용 원문·이미지·연락처는 남기지 않아요",
    ],
  },
  {
    t: "어디에 쓰나요?",
    items: ["로그인과 내 기록 불러오기", "포트폴리오 만들기와 PDF 저장", "서비스 문제 확인과 개선(내용을 보지 않는 사용 기록만 사용)"],
  },
  {
    t: "누가 볼 수 있나요?",
    items: [
      "기록과 이미지는 기본값이 비공개이고, 내 계정에서만 볼 수 있어요.",
      "공개 링크는 만들지 않아요. 포트폴리오는 PDF로 직접 저장해서 제출해요.",
      "연락처는 포트폴리오에 넣을지 직접 정해요(기본은 끔).",
    ],
  },
  {
    t: "얼마나 보관하나요?",
    items: [
      "삭제한 프로젝트와 포트폴리오는 휴지통에 30일 보관한 뒤 지워져요.",
      "계정 삭제를 요청하면 내 기록과 이미지를 모두 지워요. 이미 PDF로 저장해 둔 파일은 지울 수 없어요.",
      "백업이 남는 기간은 서비스를 공개하기 전에 정해서 알려 드릴게요.",
    ],
  },
  {
    t: "데이터는 어디에 저장되나요?",
    items: ["데이터베이스와 이미지 저장은 Supabase, 웹사이트 운영은 Vercel을 사용해요."],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="시작 화면으로" className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <Link href="/auth" className="inline-flex min-h-11 items-center text-sm text-accent">
            로그인으로 돌아가기
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p role="note" className="mb-6 rounded-card bg-accent-soft p-4 text-sm">
          <strong>샘플 초안입니다.</strong> 서비스를 공개하기 전에 정식 문구와 문의처를 확정해요. 지금은 이 서비스가 하려는 방식을 적어 둔 것이에요.
        </p>
        <h1 className="text-[28px] font-bold">개인정보 처리 안내</h1>
        <div className="mt-8 flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.t}>
              <h2 className="text-xl font-semibold">{s.t}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
