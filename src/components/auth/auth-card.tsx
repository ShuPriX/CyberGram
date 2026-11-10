import type * as React from "react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="rounded-xl border bg-card p-6 shadow-card sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <p className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</p> : null}
    </>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: React.ReactNode }) {
  const tones = {
    info: "border-border bg-muted text-muted-foreground",
    success: "border-success/30 bg-success-soft text-success",
    error: "border-destructive/30 bg-destructive-soft text-destructive-soft-foreground",
  } as const;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-md border px-3 py-2.5 text-[13px] leading-snug ${tones[tone]}`}>
      {children}
    </p>
  );
}
