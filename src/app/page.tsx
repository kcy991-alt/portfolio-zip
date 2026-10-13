import Link from "next/link";
import { LandingVisual } from "@/components/landing-visual";
import { HomePageViewed } from "@/components/amplitude";
import { Logo } from "@/components/logo";
import { CountUp, GlassHeader, MotionRoot, Reveal } from "@/components/motion-kit";
import { STEPS } from "@/templates/pm-v1";

// 카피는 docs/landing-copy.md (2026-10-08 확정)를 따른다. 숫자와 출처는 그 문서의 표와 같아야 한다.

const startBtn =
  "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-control bg-accent px-6 font-semibold text-white hover:bg-accent-hover";

/** 유리 뒤에서 비치는 장식용 빛 번짐 */
function Blob({ className }: { className: string }) {
  return <span aria-hidden className={`blob ${className}`} />;
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2 className="text-balance text-[22px] font-bold leading-snug sm:text-[28px] sm:leading-[38px]">{children}</h2>
      {sub && <p className="mt-3 text-muted">{sub}</p>}
    </Reveal>
  );
}

function StatCard({
  value,
  decimals = 0,
  text,
  source,
  icon,
  delay = 0,
}: {
  value: number;
  decimals?: number;
  text: string;
  source: React.ReactNode;
  icon?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="glass rounded-card p-6">
      <p className="flex items-center justify-between gap-2">
        <CountUp to={value} decimals={decimals} suffix="%" className="text-[40px] font-bold leading-none text-accent" />
        {icon && (
          <span aria-hidden className="text-[32px] leading-none">
            {icon}
          </span>
        )}
      </p>
      <p className="mt-3 text-balance font-medium">{text}</p>
      {source && <p className="mt-2 text-sm text-muted">{source}</p>}
    </Reveal>
  );
}

const BUBBLES = [
  { icon: "🤔", text: "어디서 시작하죠? 예시가 필요해요" },
  { icon: "🔎", text: "끝나고 나면 자료 찾기가 어려워요" },
  { icon: "😵", text: "잘 쓰고 있는지 모르겠어요" },
  { icon: "🗂️", text: "경험이 여기저기 흩어져 있어요" },
];

const COMPARE = [
  ["뭘 써야 할지 몰라 막막해요", "질문과 예시를 따라 시작해요"],
  ["자료와 링크가 여기저기 흩어져요", "프로젝트별로 한곳에 모아 둬요"],
  ["수치가 없으면 어떻게 써야 할지 막막해요", "수치가 없어도 경험을 구체화할 수 있어요"],
  ["지원할 때마다 복사해서 다시 고쳐요", "원본은 그대로 두고, 사본만 수정해요"],
  ["빠뜨린 내용이 있는지 알기 어려워요", "출력 전에 빠진 내용을 확인해요"],
];

const HOW = [
  { n: "STEP 01", icon: "✍️", t: "프로젝트가 끝나면 바로 기록해요.", d: "기억이 선명할 때 프로젝트 이름, 역할, 문제만 먼저 적어도 괜찮아요." },
  {
    n: "STEP 02",
    icon: "💬",
    t: "10단계 질문을 따라 경험을 구체화해요",
    d: "질문과 예시를 참고해 차근차근 작성해요. 지금 기억나지 않는 내용은 나중에 채워도 돼요.",
    // 기획서가 있으면 이 단계를 AI로 앞당길 수 있다는 점을 눈에 띄게 알린다. portfolio_zip이 문서를 읽는 것이 아니라 사용자가 자기 AI를 쓰는 방식이다(spec F16).
    highlight: { t: "✨ 기획서가 있다면, AI로 초안부터", d: "내 AI에 기획서와 제공된 프롬프트를 보내고, 결과를 붙여넣으면 초안이 완성돼요." },
  },
  { n: "STEP 03", icon: "📄", t: "필요한 프로젝트를 골라 포트폴리오로 만들어요", d: "지원할 프로젝트를 골라 하나로 묶고, PDF로 저장해요.", note: "PDF 저장은 컴퓨터에서 하는 것을 권장해요." },
];

export default function Home() {
  return (
    <MotionRoot>
    <HomePageViewed />
    <div className="flex flex-1 flex-col">
      {/* 자바스크립트가 꺼진 환경에서는 나타나는 효과 없이 바로 보이게 한다 */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <GlassHeader>
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-8">
          <Logo />
          <nav aria-label="서비스 안내" className="hidden items-center gap-6 text-sm text-muted lg:flex">
            <a href="#problem" className="hover:text-ink">왜 막막할까요</a>
            <a href="#how" className="hover:text-ink">작성 방법</a>
            <a href="#steps" className="hover:text-ink">10단계 질문</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="hidden min-h-11 items-center px-2 text-sm text-muted hover:text-ink sm:inline-flex">
              로그인
            </Link>
            <Link href="/welcome" className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
              지금 써 보기
            </Link>
          </div>
        </div>
      </GlassHeader>

      <main className="flex-1 break-keep">
        {/* 1. 첫 화면 */}
        <section className="relative overflow-hidden bg-gradient-to-b from-accent-soft/70 to-canvas px-4 pb-16 pt-12 sm:px-8 sm:pt-16">
          <Blob className="-left-24 top-10 h-72 w-72 bg-[#8aa4ff]" />
          <Blob className="right-0 top-0 h-80 w-80 bg-[#b9a6ff] [animation-delay:-6s]" />
          <Blob className="bottom-0 left-1/3 h-64 w-64 bg-[#7fd6ff] [animation-delay:-11s]" />
          <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="min-w-0">
              <Reveal as="p" y={12} className="glass inline-block rounded-full px-3 py-1 text-sm font-medium text-accent">
                기획·PM 지원자를 위한 Career Archive, portfolio_zip
              </Reveal>
              <Reveal delay={0.08}>
              <h1 className="mt-5 text-[32px] font-bold leading-[44px] sm:text-[40px] sm:leading-[54px] lg:text-[46px] lg:leading-[62px]">
                막막했던 포트폴리오,
                <br />
                <span className="text-accent">10단계 질문</span>에 답하면
                <br />
                초안이 완성돼요
              </h1>
              </Reveal>
              <Reveal as="p" delay={0.16} className="mt-5 max-w-xl text-[17px] leading-[28px] text-muted">
                질문과 예시를 따라 답하다 보면 하나의 포트폴리오로 정리돼요.
              </Reveal>
              <Reveal delay={0.24} className="mt-7 flex flex-wrap gap-3">
                <Link href="/welcome" className={startBtn}>
                  로그인 없이 지금 써 보기 →
                </Link>
                <a
                  href="#steps"
                  className="glass inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-control px-6 font-medium hover:bg-white"
                >
                  10단계 질문 미리 보기
                </a>
              </Reveal>
              <Reveal as="p" delay={0.3} y={8} className="mt-4 text-sm text-muted">
                로그인하면 작성한 내용을 저장할 수 있어요.
              </Reveal>
            </div>
            <Reveal delay={0.2} y={32} className="min-w-0">
              <LandingVisual />
            </Reveal>
          </div>
        </section>

        {/* 2. 공감 */}
        <section id="problem" className="relative overflow-hidden px-4 py-20 sm:px-8">
          <Blob className="-right-20 top-24 h-72 w-72 bg-[#9fb5ff]" />
          <Blob className="-left-24 bottom-32 h-80 w-80 bg-[#c5b4ff] [animation-delay:-8s]" />
          <div className="relative mx-auto max-w-[1180px]">
            <SectionTitle>취업에 중요한 직무 경험, 제대로 보여주고 있나요?</SectionTitle>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
              <StatCard
                value={73.7}
                decimals={1}
                icon="📄" text="신입도 포트폴리오가 필요하다고 답했어요"
                source="인크루트, 2022 (사무직 직장인·구직자 839명)"
              />
              <StatCard
                value={81.6}
                decimals={1}
                delay={0.1}
                icon="💼" text="기업이 신규 채용에서 직무 경험을 가장 중요하게 봐요"
                source="한국경영자총협회, 2025 (100인 이상 500개사)"
              />
            </div>

            <Reveal as="h3" className="mx-auto mt-20 max-w-2xl text-balance text-center text-xl font-bold leading-snug sm:text-2xl">
              막상 내 경험을 정리하려면 막막하죠.
            </Reveal>
            <ul className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
              {BUBBLES.map((b, i) => (
                <Reveal as="li" delay={i * 0.08} key={b.text} className="glass flex items-center gap-3 rounded-[20px] rounded-bl-[4px] px-5 py-4 text-lg font-medium">
                  <span aria-hidden className="text-[28px] leading-none">
                    {b.icon}
                  </span>
                  <span>“{b.text}”</span>
                </Reveal>
              ))}
            </ul>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
              <StatCard value={85} text="기억이 안 나 자료를 다시 찾았어요" source={null} />
              <StatCard value={70} delay={0.1} text="수치 없이 “참여했습니다”로 적었어요" source={null} />
              <StatCard value={45} delay={0.2} text="“적을 기준이 없다”가 불만 1위였어요" source={null} />
            </div>
            <p className="mt-4 text-center text-sm text-muted">출처: 자체 설문 (응답 26명 중 포트폴리오·자소서 작성 경험자 20명 기준, 2026.10)</p>
          </div>
        </section>

        {/* 3. 기존 방식과의 차이 */}
        <section id="intro" className="bg-gradient-to-b from-accent-soft to-canvas px-4 py-20 sm:px-8">
          <div className="mx-auto max-w-[1180px]">
            <SectionTitle>빈 문서 앞에서 고민하는 대신, 질문에 답해 보세요.</SectionTitle>
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 items-stretch overflow-hidden rounded-card border border-line shadow-card">
              <p className="flex items-center justify-center gap-2 bg-[#e9ebef] px-3 py-4 text-center text-sm font-semibold text-muted sm:text-base">
                <span aria-hidden className="hidden sm:inline">😩</span> 빈 문서에서 시작하면
              </p>
              <p className="flex items-center justify-center gap-2 bg-accent px-3 py-4 text-center text-sm font-bold text-white sm:text-base">
                <span aria-hidden className="hidden sm:inline">✨</span> portfolio_zip
              </p>
              {COMPARE.map(([a, b], i) => (
                <div key={a} className="contents">
                  <Reveal as="p" y={14} delay={i * 0.1} className="flex items-center justify-center gap-2 border-t border-line bg-canvas px-3 py-5 text-center text-sm text-muted sm:px-6 sm:text-base">
                    <span aria-hidden className="shrink-0 font-bold text-danger">
                      ✕
                    </span>
                    <span>{a}</span>
                  </Reveal>
                  <Reveal as="p" y={14} delay={i * 0.1 + 0.05} className="flex items-center justify-center gap-2 border-t border-accent/20 bg-accent-soft px-3 py-5 text-center text-sm font-bold text-ink sm:px-6 sm:text-lg">
                    <span aria-hidden className="shrink-0 text-accent">
                      ✔
                    </span>
                    <span>{b}</span>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 이렇게 써요 */}
        <section id="how" className="relative overflow-hidden px-4 py-20 sm:px-8">
          <Blob className="left-1/4 top-20 h-72 w-72 bg-[#a9bcff]" />
          <Blob className="-right-16 bottom-10 h-72 w-72 bg-[#9ee3ff] [animation-delay:-9s]" />
          <div className="relative mx-auto max-w-[1180px]">
            <SectionTitle>경험 기록부터 포트폴리오 완성까지, 단 3단계</SectionTitle>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {HOW.map((s, i) => (
                <Reveal as="li" delay={i * 0.12} key={s.n} className="glass relative flex flex-col items-center rounded-card px-6 pb-8 pt-10 text-center">
                  <span aria-hidden className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xl font-bold text-white shadow-card">
                    {i + 1}
                  </span>
                  <span aria-hidden className="text-[44px] leading-none">
                    {s.icon}
                  </span>
                  <p className="mt-4 text-sm font-bold tracking-wide text-accent">{s.n}</p>
                  <h3 className="mt-2 text-balance text-xl font-bold leading-snug">{s.t}</h3>
                  <p className="mt-3 text-balance text-muted">{s.d}</p>
                  {s.highlight && (
                    <div className="mt-4 w-full rounded-control border border-accent/30 bg-accent-soft px-4 py-3">
                      <p className="text-balance font-bold text-accent">{s.highlight.t}</p>
                      <p className="mt-1 text-balance text-sm text-muted">{s.highlight.d}</p>
                    </div>
                  )}
                  {s.note && <p className="mt-3 rounded-full bg-canvas px-3 py-1 text-sm text-muted">{s.note}</p>}
                  {i < HOW.length - 1 && (
                    <span aria-hidden className="absolute -right-7 top-1/2 hidden -translate-y-1/2 text-2xl text-accent md:block">
                      →
                    </span>
                  )}
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. 신뢰 */}
        <section id="steps" className="relative overflow-hidden bg-dark px-4 py-20 text-white sm:px-8">
          <Blob className="-left-20 top-10 h-80 w-80 bg-[#315be8] !opacity-40" />
          <Blob className="-right-20 bottom-0 h-80 w-80 bg-[#7c5cff] !opacity-30 [animation-delay:-7s]" />
          <div className="relative mx-auto max-w-[1180px]">
            <Reveal as="h2" className="mx-auto max-w-2xl text-center text-[22px] font-bold leading-snug sm:text-[28px] sm:leading-[38px]">
              무엇을 써야 할지 고민하지 않도록, 질문부터 준비했어요.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mx-auto mt-4 max-w-2xl text-center text-white/75">
              9년 차 PM의 작성 방식과 한국PM협회가 주관하는 PSC 자료실의 ‘PM 포트폴리오 템플릿’을 참고해, 경험을 구체화하는 10단계 질문으로 만들었어요.
            </Reveal>
            <ol className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="10단계 질문">
              {STEPS.map((s, i) => (
                <Reveal as="li" delay={(i % 5) * 0.07} y={18} key={s.key} className="glass-dark rounded-control p-4">
                  <p className="text-xs font-bold text-white/60">{String(s.order).padStart(2, "0")}</p>
                  <p className="mt-1 font-semibold">{s.label}</p>
                  <p className="mt-2 text-sm leading-[22px] text-white/70">{s.questions[0]}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. 마무리 */}
        <section className="relative overflow-hidden bg-accent-soft px-4 py-20 text-center sm:px-8">
          <Blob className="left-1/4 -top-10 h-64 w-64 bg-[#8aa4ff]" />
          <Blob className="right-1/4 -bottom-10 h-64 w-64 bg-[#c5b4ff] [animation-delay:-5s]" />
          <Reveal className="relative">
            <h2 className="text-[22px] font-bold sm:text-[28px]">첫 프로젝트 하나부터 남겨 보세요.</h2>
            <p className="mt-3 text-muted">프로젝트 이름, 역할, 문제, 한 일, 결과. 이 다섯 가지만 적어도 충분한 시작이에요.</p>
            <div className="mt-8">
              <Link href="/welcome" className={startBtn}>
                로그인 없이 지금 써 보기
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-panel px-4 py-8 text-sm text-muted sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3">
          <span>portfolio_zip (가칭)</span>
          <span className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ink">
              개인정보 처리 안내
            </Link>
            <span>로그인 없이 써 볼 수 있어요 · 저장하려면 로그인해요</span>
          </span>
        </div>
      </footer>
    </div>
    </MotionRoot>
  );
}
