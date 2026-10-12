import { Suspense } from "react";
import { ProjectScreen } from "@/components/project-screen";

async function ProjectContent({ params }: { params: PageProps<"/workspace/projects/[id]">["params"] }) {
  const { id } = await params;
  return <ProjectScreen id={id} />;
}

export default function ProjectPage(props: PageProps<"/workspace/projects/[id]">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">프로젝트를 불러오는 중이에요…</p>}>
      <ProjectContent params={props.params} />
    </Suspense>
  );
}
