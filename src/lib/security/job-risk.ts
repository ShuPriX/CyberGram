/**
 * Scam-pattern screening for job listings.
 *
 * Fake postings in this field follow recognisable patterns: asking the candidate to pay,
 * moving the conversation to personal chat apps, promising outcomes, or collecting identity
 * documents up front. A match never rejects a listing on its own — it holds it for a human
 * moderator and records why.
 */

export type JobRiskFlag = { code: string; label: string; severity: "high" | "medium" };

const RULES: { code: string; label: string; severity: "high" | "medium"; pattern: RegExp }[] = [
  {
    code: "payment_required",
    label: "Asks candidates for money (fee, deposit or paid training)",
    severity: "high",
    pattern:
      /\b(registration|application|processing|training|security|joining|onboarding|placement|enrol+ment)\s+(fee|fees|deposit|charge|charges)\b|\b(pay|deposit|transfer)\b[^.\n]{0,40}\b(to\s+(apply|register|join|start)|before\s+(joining|the\s+interview))\b|\brefundable\s+(deposit|amount)\b/i,
  },
  {
    code: "guaranteed_outcome",
    label: "Promises a guaranteed job, placement or income",
    severity: "high",
    pattern: /\b(100%\s+(job|placement)|guaranteed\s+(job|placement|selection|income|offer)|job\s+guarantee|assured\s+placement|no\s+interview\s+required)\b/i,
  },
  {
    code: "off_platform_chat",
    label: "Directs candidates to WhatsApp or Telegram",
    severity: "medium",
    pattern: /\b(whats\s?app|telegram|signal)\b[^.\n]{0,40}(\+?\d[\d\s-]{7,}|only|@\w+|t\.me\/)|\bt\.me\/\w+|\bwa\.me\/\d+/i,
  },
  {
    code: "sensitive_documents",
    label: "Requests identity or banking documents up front",
    severity: "high",
    pattern:
      /\b(send|share|submit|provide)\b[^.\n]{0,60}\b(aadhaar|aadhar|pan\s+card|passport\s+copy|bank\s+(account|details)|ssn|social\s+security\s+number|otp|cvv|debit\s+card|credit\s+card)\b/i,
  },
  {
    code: "unrealistic_pay",
    label: "Unrealistic earnings claims",
    severity: "medium",
    pattern: /\b(earn|make)\b[^.\n]{0,25}\b(per\s+day|daily|a\s+day|from\s+home)\b[^.\n]{0,30}(₹|rs\.?|inr|\$)\s?\d|\beasy\s+money\b|\bno\s+experience\b[^.\n]{0,30}\b(high|huge)\s+(salary|income)\b/i,
  },
  {
    code: "crypto_payment",
    label: "Mentions payment in cryptocurrency or gift cards",
    severity: "medium",
    pattern: /\b(paid\s+in|payment\s+(in|via))\s+(crypto\w*|bitcoin|usdt|gift\s+cards?)\b/i,
  },
];

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|proton(mail)?|rediffmail|aol|icloud|yandex|mail)\.(com|in|co\.in|me|ru)\b/i;

export function assessJobRisk(input: { title: string; description: string; applyUrl?: string | null; companyVerified?: boolean }): JobRiskFlag[] {
  const text = `${input.title}\n${input.description}`;
  const flags: JobRiskFlag[] = RULES.filter((rule) => rule.pattern.test(text)).map(({ code, label, severity }) => ({ code, label, severity }));

  // Applications sent to a personal mailbox are common in fraud and rare for real employers.
  if (!input.companyVerified && FREE_MAIL.test(text) && /\b(send|email|mail|share)\b[^.\n]{0,40}\b(cv|resume|résumé|profile)\b/i.test(text)) {
    flags.push({ code: "personal_email", label: "Collects applications at a personal email address", severity: "medium" });
  }
  return flags;
}

/** Listings with any high-severity match, or several medium ones, wait for a moderator. */
export function requiresReview(flags: JobRiskFlag[]): boolean {
  return flags.some((f) => f.severity === "high") || flags.length >= 2;
}
