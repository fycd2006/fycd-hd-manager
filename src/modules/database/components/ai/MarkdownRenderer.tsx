'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

import { normalizeMarkdownAndLatex } from './markdownUtils'
export { normalizeMarkdownAndLatex }

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(function MarkdownRenderer({
  content,
  className = '',
}) {
  const normalized = React.useMemo(() => normalizeMarkdownAndLatex(content), [content])

  return (
    <div className={`ai-markdown-content ${className}`} style={{ wordBreak: 'break-word', fontSize: '13px', lineHeight: 1.6 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 style={{ fontSize: '15px', fontWeight: 700, margin: '12px 0 6px', color: '#0f172a', letterSpacing: '-0.2px' }} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 6px', color: '#0f172a', letterSpacing: '-0.2px' }} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '10px 0 4px', color: '#1e293b' }} {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 style={{ fontSize: '12.5px', fontWeight: 600, margin: '8px 0 3px', color: '#334155' }} {...props} />
          ),
          p: ({ node, ...props }) => (
            <p style={{ margin: '0 0 8px', lineHeight: 1.6 }} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul style={{ margin: '4px 0 8px', paddingLeft: '18px', listStyleType: 'disc' }} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol style={{ margin: '4px 0 8px', paddingLeft: '18px', listStyleType: 'decimal' }} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li style={{ margin: '3px 0', lineHeight: 1.5 }} {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong style={{ fontWeight: 700, color: '#0f172a' }} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em style={{ fontStyle: 'italic', color: '#475569' }} {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              style={{
                margin: '8px 0',
                padding: '6px 12px',
                borderLeft: '3px solid #3b82f6',
                backgroundColor: '#f8fafc',
                color: '#475569',
                borderRadius: '0 6px 6px 0',
                fontSize: '12.5px',
              }}
              {...props}
            />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n')
            if (isInline) {
              return (
                <code
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono, monospace), ui-monospace, monospace',
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <pre
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  overflowX: 'auto',
                  margin: '8px 0',
                  fontFamily: 'var(--font-mono, monospace), ui-monospace, monospace',
                }}
              >
                <code {...props}>{children}</code>
              </pre>
            )
          },
          table: ({ node, ...props }) => (
            <div style={{ overflowX: 'auto', margin: '10px 0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }} {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th style={{ padding: '6px 10px', fontWeight: 600, color: '#475569' }} {...props} />
          ),
          td: ({ node, ...props }) => (
            <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155' }} {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              style={{ color: '#2563eb', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
})
