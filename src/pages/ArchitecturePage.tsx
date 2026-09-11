import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import architectureMd from '../content/architecture.md?raw';
import { Card } from '../components/ui';

/**
 * 訂閱架構設計文件。
 *
 * 內容是 console/docs/subscription/architecture.md 的副本(建置時以 ?raw 內嵌),
 * 因為原檔在另一個 repo,無法在此 build 時直接參照。原檔更新後需重新複製:
 *   cp ../../Git/console/docs/subscription/architecture.md src/content/architecture.md
 */
export function ArchitecturePage() {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">訂閱架構設計</h2>
            <p className="mt-1 text-sm text-slate-600">
              本試算機的定價結構從哪來 —— 訂閱、金鑰、簽章與硬體信任根如何橫跨 console、
              local_agent、A1 裝置與 Portal 四個 repo。
            </p>
          </div>
          <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
            console/docs/subscription/architecture.md
          </code>
        </div>
      </Card>

      <Card>
        <article className="max-w-none">
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {architectureMd}
          </Markdown>
        </article>
      </Card>
    </div>
  );
}

/** 用本專案既有的視覺語彙渲染 markdown,而不是套一整包 typography plugin。 */
const mdComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 border-b border-slate-200 pb-2 text-xl font-bold text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-8 mb-3 border-b border-slate-200 pb-1.5 text-base font-bold text-slate-900">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-5 mb-2 text-sm font-semibold text-blue-800">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-2.5 text-sm leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="pl-1">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em className="text-slate-600">{children}</em>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-4 border-amber-300 bg-amber-50 py-2 pl-3 text-sm text-amber-900">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-slate-200" />,
  // ASCII 架構圖走這裡:必須保留等寬與換行,窄螢幕時橫向捲動而非擠壓
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-snug text-slate-100">
      {children}
    </pre>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = Boolean(className) || String(children).includes('\n');
    if (isBlock) return <code className="font-mono">{children}</code>;
    return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">{children}</code>;
  },
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="border-b-2 border-slate-300 bg-slate-50 text-left">{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-2.5 py-2 text-left font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-slate-100 px-2.5 py-2 align-top text-slate-700">{children}</td>
  ),
};
