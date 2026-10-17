import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_ROUTE_SLUGS } from "@/lib/docs/catalog";
import { DocArticle, docMetadata } from "../doc-article";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_ROUTE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return docMetadata(slug);
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!DOC_ROUTE_SLUGS.includes(slug)) notFound();
  return <DocArticle slug={slug} />;
}
