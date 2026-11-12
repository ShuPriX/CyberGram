import { Building2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
  "2xl": "size-28 text-3xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

type AvatarProps = {
  name: string;
  /** File id of the uploaded image; falls back to initials when absent. */
  fileId?: string | null;
  size?: AvatarSize;
  /** Organisations use a rounded square and a building glyph instead of initials. */
  shape?: "circle" | "square";
  className?: string;
};

export function Avatar({ name, fileId, size = "md", shape = "circle", className }: AvatarProps) {
  const base = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden border bg-muted font-mono font-medium text-muted-foreground",
    shape === "circle" ? "rounded-sm" : "rounded-sm border-border-strong",
    SIZES[size],
    className,
  );
  if (fileId) {
    return (
      <span className={base}>
        <img src={`/api/files/${fileId}`} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={base} aria-hidden="true">
      {shape === "square" ? <Building2 className="size-[45%]" /> : initials(name)}
    </span>
  );
}
