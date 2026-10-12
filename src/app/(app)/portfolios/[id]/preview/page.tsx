import { Suspense } from "react";
import { PortfolioOutputScreen } from "@/components/portfolio-output-screen";

async function Content({ params }: { params: PageProps<"/portfolios/[id]/preview">["params"] }) {
  const { id } = await params;
  return <PortfolioOutputScreen id={id} mode="preview" />;
}

export default function PortfolioPreviewPage(props: PageProps<"/portfolios/[id]/preview">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">미리보기를 준비하는 중이에요…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
