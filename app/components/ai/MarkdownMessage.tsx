"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = preRef.current?.textContent ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable in insecure contexts.
    }
  };

  return (
    <div className="ai-code-wrap">
      <button type="button" className="ai-code-copy" onClick={copy} title="نسخ الكود">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

interface MarkdownMessageProps {
  content: string;
}

/**
 * Rich renderer for assistant replies: headings, bold text, lists, tables,
 * quotes, links, and fenced code blocks. RTL is inherited from the page while
 * code blocks stay LTR and each block uses `dir="auto"` for mixed language.
 */
export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          p: ({ children }) => <p dir="auto">{children}</p>,
          li: ({ children }) => <li dir="auto">{children}</li>,
          h1: ({ children }) => <h1 dir="auto">{children}</h1>,
          h2: ({ children }) => <h2 dir="auto">{children}</h2>,
          h3: ({ children }) => <h3 dir="auto">{children}</h3>,
          h4: ({ children }) => <h4 dir="auto">{children}</h4>,
          table: ({ children }) => (
            <div className="ai-table-wrap">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
