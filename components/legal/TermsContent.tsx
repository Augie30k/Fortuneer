import {
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
  type TermsBlock,
  type TermsSegment,
} from '@/lib/terms'
import { cn } from '@/lib/utils'

/** Web renderer for the Terms & Conditions. The text itself lives as data in
 *  lib/terms.ts (shared with the mobile app via @fortuneer/shared) so both
 *  platforms always show exactly the terms users accept. Rendered identically
 *  on the public /terms page and the /terms/accept gate. */
export default function TermsContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Terms &amp; Conditions</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE_DATE}
        </p>
      </div>

      {TERMS_SECTIONS.map((section) => (
        <section key={section.n} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {section.n}. {section.title}
          </h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  )
}

function Block({ block }: { block: TermsBlock }) {
  if (block.type === 'list') {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {block.items.map((item, i) => (
          <li key={i}>
            <Segments segments={item} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p className={cn(block.caps && 'uppercase')}>
      <Segments segments={block.segments} />
    </p>
  )
}

function Segments({ segments }: { segments: TermsSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (typeof seg === 'string') return <span key={i}>{seg}</span>
        if ('bold' in seg) return <strong key={i}>{seg.bold}</strong>
        return (
          <a
            key={i}
            className="underline underline-offset-2"
            href={seg.link.href}
            target="_blank"
            rel="noreferrer"
          >
            {seg.link.text}
          </a>
        )
      })}
    </>
  )
}
