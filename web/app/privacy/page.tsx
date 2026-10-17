import type { Metadata } from "next";
import { DocArticle, docMetadata } from "../docs/doc-article";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return docMetadata("privacy");
}

export default function Page() {
  return <DocArticle slug="privacy" />;
}
