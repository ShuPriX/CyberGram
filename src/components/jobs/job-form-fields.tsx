import { SkillDatalist } from "@/components/shared/fields";
import { InputField, SelectField, TextareaField } from "@/components/ui/form";
import type { jobs } from "@/db/schema";
import { COUNTRIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_CATEGORIES, LIMITS, SALARY_CURRENCIES, SALARY_PERIODS, skillLabel, WORK_ARRANGEMENTS } from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";

type Job = typeof jobs.$inferSelect;

/** The fields every listing shares, whether a company posts it or a member submits it. */
export function JobFormFields({ job }: { job?: Job }) {
  return (
    <>
      <InputField label="Job title" name="title" required minLength={4} maxLength={140} defaultValue={job?.title} placeholder="SOC Analyst (L1)" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Role category" name="category" required placeholder="Select a category" options={JOB_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))} defaultValue={job?.category ?? ""} />
        <SelectField label="Experience level" name="experienceLevel" required options={EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: `${l.label} (${l.range})` }))} defaultValue={job?.experienceLevel ?? "fresher"} />
        <SelectField label="Employment type" name="employmentType" required options={EMPLOYMENT_TYPES} defaultValue={job?.employmentType ?? "full_time"} />
        <SelectField label="Work arrangement" name="workArrangement" required options={WORK_ARRANGEMENTS} defaultValue={job?.workArrangement ?? "onsite"} />
        <InputField label="City / location" name="location" optional maxLength={120} defaultValue={job?.location ?? ""} placeholder="Bengaluru, Karnataka" />
        <SelectField label="Country" name="country" optional placeholder="Not location-specific" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={job?.country ?? ""} />
      </div>
      <TextareaField
        label="Description"
        name="description"
        required
        rows={14}
        minLength={80}
        maxLength={20_000}
        defaultValue={job?.description}
        hint="Markdown is supported. Describe the responsibilities, requirements and the hiring process. Listings that ask candidates for money are removed."
      />
      <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <legend className="px-1 text-[13px] font-semibold">Salary (optional, recommended)</legend>
        <InputField label="Minimum" name="salaryMin" type="number" min={0} optional defaultValue={job?.salaryMin ?? ""} />
        <InputField label="Maximum" name="salaryMax" type="number" min={0} optional defaultValue={job?.salaryMax ?? ""} />
        <SelectField label="Currency" name="salaryCurrency" optional placeholder="—" options={SALARY_CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={job?.salaryCurrency ?? ""} />
        <SelectField label="Period" name="salaryPeriod" options={SALARY_PERIODS} defaultValue={job?.salaryPeriod ?? "year"} />
      </fieldset>
      <InputField
        label="Skills"
        name="skills"
        optional
        list="skill-options"
        defaultValue={job?.skills.map(skillLabel).join(", ") ?? ""}
        placeholder="SIEM, Splunk, Incident Response"
        hint={`Separate with commas. Up to ${LIMITS.skillsPerJob}.`}
      />
      <SkillDatalist />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Certifications" name="certifications" optional defaultValue={job?.certifications.join(", ") ?? ""} placeholder="Security+, CEH, OSCP" hint="Preferred or required, separated by commas." />
        <InputField label="Application deadline" name="deadline" type="date" optional defaultValue={toDateInputValue(job?.deadline)} hint="The listing closes automatically on this date." />
      </div>
    </>
  );
}
