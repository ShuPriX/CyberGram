import { z } from "zod";
import { COUNTRY_CODES, RESERVED_USERNAMES } from "./constants";
import { cleanInline, cleanText, isHttpUrl } from "./text";
import { slugify } from "./utils";

/**
 * Reusable Zod building blocks for server actions. Every mutation validates and normalises
 * its input through these before touching the database.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Required multi-line text, normalised and length-bounded. */
export const zText = (max: number, min = 1) =>
  z
    .string({ error: "This field is required." })
    .transform(cleanText)
    .pipe(z.string().min(min, min === 1 ? "This field is required." : `Use at least ${min} characters.`).max(max, `Keep this under ${max} characters.`));

/** Required single-line text. */
export const zInline = (max: number, min = 1) =>
  z
    .string({ error: "This field is required." })
    .transform(cleanInline)
    .pipe(z.string().min(min, min === 1 ? "This field is required." : `Use at least ${min} characters.`).max(max, `Keep this under ${max} characters.`));

export const zOptionalText = (max: number) => z.preprocess(blankToUndefined, zText(max).optional());
export const zOptionalInline = (max: number) => z.preprocess(blankToUndefined, zInline(max).optional());

export const zHttpUrl = z
  .string({ error: "Enter a URL." })
  .trim()
  .max(2048, "That URL is too long.")
  .refine(isHttpUrl, "Enter a full URL starting with https://");

export const zOptionalUrl = z.preprocess(blankToUndefined, zHttpUrl.optional());

/** HTML checkboxes submit "on"; switches and hidden inputs submit "true". */
export const zBool = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

export const zId = z.string().regex(/^[a-z0-9]{8,40}$/, "Invalid reference.");
export const zOptionalId = z.preprocess(blankToUndefined, zId.optional());

export const zEmail = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

export const zPassword = z.string({ error: "Enter a password." }).min(1, "Enter a password.").max(1024);

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28})[a-z0-9]$/;
export const zUsername = z
  .string({ error: "Choose a handle." })
  .trim()
  .toLowerCase()
  .refine((v) => USERNAME_PATTERN.test(v), "Use 3–30 lowercase letters, numbers, hyphens or underscores.")
  .refine((v) => !RESERVED_USERNAMES.has(v), "That handle is reserved.");

// Display names: block characters used to fake verification marks or staff labels.
const NAME_FORBIDDEN = /[✓✔☑✅🛡🔒⭐★☆©®™<>{}[\]\\|^~`]/u;
export const zDisplayName = zInline(80, 2)
  .refine((v) => !NAME_FORBIDDEN.test(v), "Names cannot contain symbols or badges.")
  .refine((v) => !/\b(official|verified|admin|moderator|support|staff)\b/i.test(v), "Names cannot contain words that imply a platform role.")
  .refine((v) => !/https?:\/\//i.test(v), "Names cannot contain links.");

/** Accepts repeated form fields (`name="x[]"`), a single value, or nothing. */
export const zStringList = (maxItems: number, itemMax = 80) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]),
    z
      .array(z.string().transform(cleanInline).pipe(z.string().min(1).max(itemMax)))
      .max(maxItems, `Choose at most ${maxItems}.`)
      .transform((items) => [...new Set(items)]),
  );

/** Accepts a comma/newline separated string and returns a de-duplicated list. */
export const zCsv = (maxItems: number, itemMax = 80) =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v
        : typeof v === "string"
          ? v
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
    z
      .array(z.string().transform(cleanInline).pipe(z.string().min(1).max(itemMax)))
      .max(maxItems, `Use at most ${maxItems} entries.`)
      .transform((items) => [...new Set(items)]),
  );

/** Skill input → canonical slugs. */
export const zSkills = (maxItems: number) =>
  zCsv(maxItems, 60).transform((items) => [...new Set(items.map((s) => slugify(s, 60)).filter((s) => s.length >= 1))]);

export const zOneOf = <T extends string>(values: readonly [T, ...T[]] | readonly T[], message = "Choose a valid option.") =>
  z.enum(values as [T, ...T[]], { error: message });

export const zOptionalOneOf = <T extends string>(values: readonly T[]) => z.preprocess(blankToUndefined, zOneOf(values).optional());

export const zManyOf = <T extends string>(values: readonly T[], maxItems = values.length) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]),
    z.array(zOneOf(values)).max(maxItems).transform((items) => [...new Set(items)]),
  );

export const zCountry = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => COUNTRY_CODES.includes(v), "Choose a country.")
    .optional(),
);

export const zOptionalInt = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: "Enter a number." }).int("Enter a whole number.").min(min).max(max).optional());

/** `YYYY-MM-DD` from <input type="date">. */
export const zDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date.");
export const zOptionalDateString = z.preprocess(blankToUndefined, zDateString.optional());

/** `YYYY-MM-DDTHH:mm` from <input type="datetime-local"> or a date; interpreted as UTC. */
export const zOptionalDateTime = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const date = new Date(/T/.test(v) ? (/(Z|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v}Z`) : `${v}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date." });
        return z.NEVER;
      }
      return date;
    })
    .optional(),
);

/** Converts a submitted form into a plain object, collecting `name[]` fields into arrays. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue; // framework-internal fields
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (key.endsWith("[]")) out[key.slice(0, -2)] = values;
    else out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

/** First message per field, keyed by the top-level field name. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
