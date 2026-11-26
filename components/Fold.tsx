import type { ReactNode } from "react";

/** タイトルだけ表示し、クリックで開閉する */
export default function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <details className="fold">
        <summary>{title}</summary>
        {children}
      </details>
    </section>
  );
}
