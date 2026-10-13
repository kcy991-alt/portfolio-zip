import { PAGE_TYPE_LABEL, type PortfolioDoc, type PortfolioPageDoc } from "@/lib/portfolio/model";
import type { PageType } from "@/templates/pm-v1";
import { ProjectPageView } from "./page-preview";

// 포트폴리오 제작 화면의 가운데에 보이는 페이지 미리보기. 편집용이라 빈 자리의 안내도 보여 준다(출력에는 나오지 않는다, spec 9.2).

const pageClass = "flex min-h-72 flex-col gap-4 rounded-card border border-line bg-panel p-6 shadow-card";
const empty = (text: string) => <p className="text-sm text-muted">{text}</p>;

function CoverView({ doc }: { doc: PortfolioDoc }) {
  const { cover } = doc;
  return (
    <div className={`${pageClass} justify-center`}>
      <p className="text-sm text-muted">{cover.targetRole || "지원 직무를 입력해 주세요"}</p>
      <h2 className="text-[28px] font-bold leading-tight">{cover.name || "이름을 입력해 주세요"}</h2>
      {cover.tagline ? <p className="text-lg">{cover.tagline}</p> : empty("한 줄 소개를 입력하면 여기에 나와요.")}
      {cover.includeContact ? (
        <div className="text-sm text-muted">
          {cover.email && <p>{cover.email}</p>}
          {cover.link && <p className="break-all">{cover.link}</p>}
          {!cover.email && !cover.link && <p>연락처를 입력해 주세요.</p>}
        </div>
      ) : (
        <p className="text-xs text-muted">연락처는 출력에 넣지 않아요. (표지 입력에서 켤 수 있어요)</p>
      )}
    </div>
  );
}

function SummaryView({ doc }: { doc: PortfolioDoc }) {
  const items = doc.summary.items;
  const titleOf = (id: string) => doc.projects.find((p) => p.id === id)?.title;
  return (
    <div className={pageClass}>
      <h2 className="text-xl font-bold">Summary</h2>
      {items.length === 0 && empty("핵심 역량을 1~5개 적으면 여기에 나와요.")}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-control border border-line p-3">
            <p className="font-semibold">{item.title || "제목 없음"}</p>
            {item.description && <p className="mt-1 whitespace-pre-wrap text-[15px]">{item.description}</p>}
            {item.projectIds.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1 text-xs">
                {item.projectIds.map((id) => (
                  <span key={id} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                    {titleOf(id) ?? "(삭제된 프로젝트)"}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileView({ doc }: { doc: PortfolioDoc }) {
  const { profile } = doc;
  const nothing = !profile.intro && profile.education.length === 0 && profile.careers.length === 0 && profile.certificates.length === 0 && profile.tools.length === 0;
  return (
    <div className={pageClass}>
      <h2 className="text-xl font-bold">프로필</h2>
      {nothing && empty("소개, 교육, 경력, 자격증, 도구를 쓰면 여기에 나와요. 비어 있는 영역은 출력에서 숨겨져요.")}
      {profile.intro && <p className="whitespace-pre-wrap">{profile.intro}</p>}
      {profile.education.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted">교육</h3>
          <ul className="mt-1 flex flex-col gap-1 text-[15px]">
            {profile.education.map((e) => (
              <li key={e.id}>
                <span className="text-muted">{e.period}</span> <strong>{e.course || e.org}</strong>
                {e.course && e.org ? ` · ${e.org}` : ""}
                {e.description && <span className="block text-sm text-muted">{e.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.careers.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted">경력</h3>
          <ul className="mt-1 flex flex-col gap-1 text-[15px]">
            {profile.careers.map((c) => (
              <li key={c.id}>
                <span className="text-muted">{c.period}</span> <strong>{c.org}</strong>
                {c.role ? ` · ${c.role}` : ""}
                {c.description && <span className="block text-sm text-muted">{c.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.certificates.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted">자격증</h3>
          <ul className="mt-1 flex flex-col gap-1 text-[15px]">
            {profile.certificates.map((c) => (
              <li key={c.id}>
                <span className="text-muted">{c.date}</span> <strong>{c.name || "이름 없음"}</strong>
                {c.issuer ? ` · ${c.issuer}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.tools.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted">도구</h3>
          <ul className="mt-1 flex flex-wrap gap-2 text-sm">
            {profile.tools.map((t) => (
              <li key={t.id} className="rounded-full border border-line bg-canvas px-3 py-1">
                {t.name || "이름 없음"}
                {t.description ? ` · ${t.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 선택한 페이지 한 장을 보여 준다 */
export function PortfolioPageView({ doc, page }: { doc: PortfolioDoc; page: PortfolioPageDoc }) {
  if (page.type === "cover") return <CoverView doc={doc} />;
  if (page.type === "summary") return <SummaryView doc={doc} />;
  if (page.type === "profile") return <ProfileView doc={doc} />;

  const copy = doc.projects.find((p) => p.id === page.portfolio_project_id);
  if (!copy) return empty("이 프로젝트를 찾을 수 없어요.");
  const pageType: PageType = page.type;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {copy.title} · {PAGE_TYPE_LABEL[page.type]}
      </p>
      <ProjectPageView title={copy.title} answers={copy.answers} page={pageType} images={copy.images} visibleSections={page.section_keys} />
    </div>
  );
}
