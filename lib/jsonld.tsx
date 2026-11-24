import { isValidElement, type ReactNode } from "react";

// Structured data (JSON-LD) for search engines. The "<" is escaped so the
// JSON can never close the script tag.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

// Plain text of a React node, so the FAQ's visible answers can double as the
// FAQPage answers without writing each one twice.
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}
