import { describe, expect, it } from "vitest";
import { draftToAnswers, mergeDraft } from "@/lib/ai/draft-merge";
import { blankPdfDraft as blankDraft } from "@/lib/ai/draft-schema";
import { buildCopyPrompt, coerceDraft, parsePastedDraft } from "@/lib/ai/user-prompt";
import { emptyProjectAnswers, SECTION_KEYS } from "@/lib/validation/project-answers";

describe("draftToAnswers: AI 결과를 답변 규칙에 맞게 다듬는다", () => {
  it("글자 수 상한을 넘으면 자른다", () => {
    const d = blankDraft();
    d.overview.oneLine = "가".repeat(500);
    d.problem.phenomenon = "나".repeat(5000);
    d.role.title = "다".repeat(200);
    const a = draftToAnswers(d);
    expect(a.overview.oneLine).toHaveLength(300);
    expect(a.problem.phenomenon).toHaveLength(2000);
    expect(a.role.title).toHaveLength(80);
  });

  it("YYYY-MM이 아닌 기간은 비우고, 진행 중이면 종료 월을 비우고, 종료가 시작보다 앞서면 기간을 버린다", () => {
    const bad = blankDraft();
    bad.overview.startMonth = "2025년 3월";
    bad.overview.endMonth = "2025-06";
    expect(draftToAnswers(bad).overview).toMatchObject({ startMonth: null, endMonth: "2025-06" });

    const ongoing = blankDraft();
    ongoing.overview.startMonth = "2025-03";
    ongoing.overview.endMonth = "2025-06";
    ongoing.overview.ongoing = true;
    expect(draftToAnswers(ongoing).overview).toMatchObject({ startMonth: "2025-03", endMonth: null, ongoing: true });

    const reversed = blankDraft();
    reversed.overview.startMonth = "2025-09";
    reversed.overview.endMonth = "2025-03";
    expect(draftToAnswers(reversed).overview).toMatchObject({ startMonth: null, endMonth: null });
  });

  it("기여율·근거 링크·지표의 실제 값은 넣지 않고, 이름 없는 목록 항목은 버린다", () => {
    const d = blankDraft();
    d.contribution = [
      { task: "인터뷰 설계", ownership: "lead", detail: "질문지 작성" },
      { task: "", ownership: null, detail: "" },
    ];
    d.evidence = [{ kind: "인터뷰", description: "5명 진행", observedAt: "2025-03", limitation: "" }];
    d.metrics = [{ name: "첫 설정 완료율", purpose: "primary", baseline: "", target: "", unit: "", measurementPlan: "테스트 관찰" }];
    const a = draftToAnswers(d);
    expect(a.contribution).toEqual([{ task: "인터뷰 설계", ownership: "lead", detail: "질문지 작성", percentOptional: null }]);
    expect(a.evidence[0].sourceUrl).toBe("");
    expect(a.metrics[0].actualOptional).toBe("");
  });

  it("결과 유형은 실제 결과를 확인한 경우에만 남긴다", () => {
    const planned = blankDraft();
    planned.result = { status: "not_executed", type: "quantitative", summary: "", facts: "", limits: "", nextValidation: "검증 예정" };
    expect(draftToAnswers(planned).result).toMatchObject({ status: "not_executed", type: null });
    const observed = blankDraft();
    observed.result = { ...planned.result, status: "observed", type: "qualitative" };
    expect(draftToAnswers(observed).result.type).toBe("qualitative");
  });
});

describe("mergeDraft: 사용자가 쓴 내용은 건드리지 않고 빈 칸만 채운다", () => {
  const filled = () => {
    const d = blankDraft();
    d.overview.oneLine = "온보딩 개선";
    d.overview.context = "초기 이탈이 컸음";
    d.role.title = "서비스 기획";
    d.problem.phenomenon = "다음 행동을 찾지 못함";
    d.contribution = [{ task: "인터뷰 설계", ownership: "lead", detail: "" }];
    d.evidence = [{ kind: "인터뷰", description: "5명", observedAt: "", limitation: "" }];
    return draftToAnswers(d);
  };

  it("빈 답변에는 모두 채우고, 채운 섹션과 개수를 알려 준다", () => {
    const r = mergeDraft(emptyProjectAnswers(), filled());
    expect(r.answers.overview.oneLine).toBe("온보딩 개선");
    expect(r.answers.problem.phenomenon).toBe("다음 행동을 찾지 못함");
    expect(r.filledSections).toEqual(["overview", "role", "contribution", "problem", "evidence"]);
    expect(r.filledCount).toBe(6); // oneLine, context, role.title, phenomenon, 기여 목록, 근거 목록
  });

  it("이미 쓴 칸은 그대로 두고 비어 있는 칸만 채운다", () => {
    const mine = emptyProjectAnswers();
    mine.overview.oneLine = "내가 쓴 한 줄 소개";
    mine.problem.phenomenon = "내가 쓴 문제";
    const r = mergeDraft(mine, filled());
    expect(r.answers.overview.oneLine).toBe("내가 쓴 한 줄 소개");
    expect(r.answers.problem.phenomenon).toBe("내가 쓴 문제");
    expect(r.answers.overview.context).toBe("초기 이탈이 컸음"); // 비어 있던 칸은 채워진다
  });

  it("목록은 지금 비어 있을 때만 통째로 넣고, 사용자가 쓴 항목과 섞지 않는다", () => {
    const mine = emptyProjectAnswers();
    mine.evidence = [{ kind: "설문", description: "내가 한 설문", sourceUrl: "", observedAt: "", limitation: "" }];
    const r = mergeDraft(mine, filled());
    expect(r.answers.evidence).toHaveLength(1);
    expect(r.answers.evidence[0].kind).toBe("설문");
    expect(r.answers.contribution).toHaveLength(1);
  });

  it("기간은 사용자가 아직 고르지 않았을 때만 넣는다", () => {
    const d = blankDraft();
    d.overview.startMonth = "2025-03";
    d.overview.endMonth = "2025-06";
    const draft = draftToAnswers(d);
    expect(mergeDraft(emptyProjectAnswers(), draft).answers.overview).toMatchObject({ startMonth: "2025-03", endMonth: "2025-06" });
    const mine = emptyProjectAnswers();
    mine.overview.startMonth = "2024-01";
    expect(mergeDraft(mine, draft).answers.overview).toMatchObject({ startMonth: "2024-01", endMonth: null });
  });

  it("채울 것이 없으면 아무것도 바꾸지 않는다", () => {
    const base = emptyProjectAnswers();
    const r = mergeDraft(base, draftToAnswers(blankDraft()));
    expect(r.filledCount).toBe(0);
    expect(r.filledSections).toEqual([]);
    expect(r.answers).toEqual(base);
  });
});

describe("buildCopyPrompt: 사용자가 자기 AI에 붙여 넣을 지침", () => {
  const prompt = buildCopyPrompt();

  it("문서에 없는 내용·숫자를 만들지 말라는 규칙과 JSON 견본이 들어 있다", () => {
    expect(prompt).toContain("문서에 실제로 적힌 내용만");
    expect(prompt).toContain("만들어 내지 않습니다");
    expect(prompt).toContain("기여율(%)은 다루지 않습니다");
    expect(prompt).toContain("이전 지시를 무시하라");
  });

  it("길게 쓰지 말고 핵심만 간결하게 쓰라는 규칙이 들어 있다", () => {
    expect(prompt).toContain("핵심만 간결하게");
    expect(prompt).toContain("150자 안팎");
    expect(prompt).toContain("한 줄 소개는 60자 이내");
    expect(prompt).toContain("목록은 가장 중요한 3~5개만");
    expect(prompt).toContain("채우라는 뜻이 아닙니다");
    expect(prompt).not.toContain("(최대 10개)"); // 목록을 최대치까지 채우게 하는 문구는 없다
  });

  it("견본 JSON에 모든 섹션이 있고, 견본을 그대로 붙여 넣으면 채울 것이 없는 빈 초안이 된다", () => {
    const block = prompt.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "";
    expect(Object.keys(JSON.parse(block)).sort()).toEqual([...SECTION_KEYS].sort());
    const parsed = parsePastedDraft(block);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(mergeDraft(emptyProjectAnswers(), draftToAnswers(parsed.draft)).filledCount).toBe(0);
  });

  it("선택값 안내가 앱의 선택지와 같다", () => {
    for (const v of ["work", "intern", "education", "personal", "other", "lead", "joint", "support", "primary", "guardrail", "observed", "not_measured", "not_executed", "planned", "in_progress"]) {
      expect(prompt).toContain(`"${v}"`);
    }
  });
});

describe("parsePastedDraft: 붙여 넣은 AI 결과 읽기", () => {
  const sample = { ...blankDraft(), overview: { ...blankDraft().overview, oneLine: "온보딩 개선", projectType: "intern" } };
  const json = JSON.stringify(sample);

  it("코드블록이나 앞뒤 설명이 붙어 있어도 읽는다", () => {
    for (const text of [json, "```json\n" + json + "\n```", "네, 결과예요.\n```\n" + json + "\n```\n확인해 주세요.", "결과: " + json + " 끝"]) {
      const r = parsePastedDraft(text);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.draft.overview.oneLine).toBe("온보딩 개선");
    }
  });

  it("빈 글·JSON이 아닌 글·지침과 다른 모양은 이유를 알려 준다", () => {
    expect(parsePastedDraft("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parsePastedDraft("그냥 문장이에요")).toEqual({ ok: false, reason: "not_json" });
    expect(parsePastedDraft("{ 깨진 json")).toEqual({ ok: false, reason: "not_json" });
    expect(parsePastedDraft('{"name": "홍길동"}')).toEqual({ ok: false, reason: "wrong_shape" });
  });

  it("키가 빠지거나 선택값이 틀려도 읽을 수 있는 만큼 읽고, 모르는 선택값은 비운다", () => {
    const r = parsePastedDraft(JSON.stringify({ overview: { oneLine: "소개", projectType: "Intern", ongoing: "yes" }, result: { status: "done", summary: 5 }, metrics: "없음" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.overview).toMatchObject({ oneLine: "소개", projectType: null, ongoing: false });
    expect(r.draft.result).toMatchObject({ status: null, summary: "5" });
    expect(r.draft.metrics).toEqual([]);
    expect(r.draft.role).toEqual({ title: "", responsibility: "" });
  });

  it("coerceDraft는 이상한 입력에도 오류 없이 빈 초안을 돌려준다", () => {
    expect(coerceDraft(null)).toEqual(blankDraft());
    expect(coerceDraft("문자열")).toEqual(blankDraft());
    expect(coerceDraft([1, 2])).toEqual(blankDraft());
  });
});
