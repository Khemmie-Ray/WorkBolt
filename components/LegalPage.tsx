import Link from "next/link";
import { CONTACT_EMAIL, type LegalDoc } from "@/lib/legal";

export function LegalPage({
  doc,
  other,
}: {
  doc: LegalDoc;
  other: { href: string; label: string };
}) {
  return (
    <article className="max-w-3xl pb-10">
      <p className="font-display text-sm font-semibold text-ink-soft">
        Last updated {doc.updated}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
        {doc.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">{doc.intro}</p>

      {doc.sections.map((section, i) => (
        <section key={section.heading} className="mt-9">
          <h2 className="flex items-baseline gap-3 font-display text-xl font-bold">
            <span className="text-sm font-semibold text-gold tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            {section.heading}
          </h2>
          {section.blocks.map((block, j) =>
            Array.isArray(block) ? (
              <ul
                key={j}
                className="mt-3 space-y-2 pl-5 leading-relaxed text-ink-soft marker:text-gold list-disc"
              >
                {block.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={j} className="mt-3 leading-relaxed text-ink-soft">
                {block}
              </p>
            ),
          )}
        </section>
      ))}

      <section className="mt-10 rounded-[20px] bg-paper p-5 shadow-ticket sm:p-6">
        <h2 className="font-display text-lg font-bold">
          Questions or requests
        </h2>
        <p className="mt-2 leading-relaxed text-ink-soft">
          {CONTACT_EMAIL ? (
            <>
              Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-ink underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              . We reply as soon as we can.
            </>
          ) : (
            "Contact the Workbolt team through the hackathon page."
          )}
        </p>
        <p className="mt-3 text-sm">
          See also the{" "}
          <Link
            href={other.href}
            className="font-semibold underline underline-offset-4"
          >
            {other.label}
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
