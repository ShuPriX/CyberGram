import { eq, desc } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { ChipGroup, SkillDatalist } from "@/components/shared/fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { ActionForm, CheckboxField, FormError, InputField, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { educations, experiences, profiles, projects } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { COUNTRIES, EMPLOYMENT_TYPES, LIMITS, OPEN_TO_WORK_VISIBILITIES, skillLabel, WORK_ARRANGEMENTS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { deleteProfileItemAction, saveEducationAction, saveExperienceAction, saveProjectAction, updateProfileAction } from "@/server/actions/profile";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Edit profile");

type Experience = typeof experiences.$inferSelect;
type Education = typeof educations.$inferSelect;
type Project = typeof projects.$inferSelect;

function ExperienceFields({ item }: { item?: Experience }) {
  return (
    <>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <InputField label="Title" name="title" required maxLength={120} defaultValue={item?.title} placeholder="SOC Analyst" />
      <InputField label="Company" name="company" required maxLength={120} defaultValue={item?.company} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Employment type" name="employmentType" optional placeholder="Not specified" options={EMPLOYMENT_TYPES} defaultValue={item?.employmentType ?? ""} />
        <InputField label="Location" name="location" optional maxLength={100} defaultValue={item?.location ?? ""} />
        <InputField label="Start date" name="startDate" type="date" required defaultValue={item?.startDate} />
        <InputField label="End date" name="endDate" type="date" optional defaultValue={item?.endDate ?? ""} />
      </div>
      <CheckboxField label="I currently work here" name="isCurrent" defaultChecked={item?.isCurrent ?? false} />
      <TextareaField label="Description" name="description" optional rows={4} maxLength={2000} defaultValue={item?.description ?? ""} placeholder="What you owned, the tooling you used, and the outcomes." />
    </>
  );
}

function EducationFields({ item }: { item?: Education }) {
  return (
    <>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <InputField label="School or institution" name="school" required maxLength={140} defaultValue={item?.school} />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Degree" name="degree" optional maxLength={120} defaultValue={item?.degree ?? ""} placeholder="B.Tech" />
        <InputField label="Field of study" name="field" optional maxLength={120} defaultValue={item?.field ?? ""} placeholder="Computer Science" />
        <InputField label="Start year" name="startYear" type="number" min={1950} max={2100} optional defaultValue={item?.startYear ?? ""} />
        <InputField label="End year (or expected)" name="endYear" type="number" min={1950} max={2100} optional defaultValue={item?.endYear ?? ""} />
      </div>
      <TextareaField label="Notes" name="description" optional rows={3} maxLength={1000} defaultValue={item?.description ?? ""} />
    </>
  );
}

function ProjectFields({ item }: { item?: Project }) {
  return (
    <>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <InputField label="Project name" name="name" required maxLength={120} defaultValue={item?.name} />
      <TextareaField label="Description" name="description" optional rows={4} maxLength={1500} defaultValue={item?.description ?? ""} />
      <InputField label="Repository URL" name="repoUrl" type="url" optional maxLength={2048} defaultValue={item?.repoUrl ?? ""} placeholder="https://github.com/you/project" />
      <InputField label="Project URL" name="url" type="url" optional maxLength={2048} defaultValue={item?.url ?? ""} />
      <InputField label="Tags" name="tags" optional defaultValue={item?.tags.join(", ") ?? ""} placeholder="python, recon, automation" hint="Up to eight, separated by commas." />
    </>
  );
}

function RowActions({ kind, id, edit }: { kind: "experience" | "education" | "project"; id: string; edit: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {edit}
      <ActionButton action={deleteProfileItemAction} input={{ kind, id }} confirm="Remove this entry?" variant="ghost" size="icon-sm" aria-label="Remove" className="text-muted-foreground hover:text-destructive">
        <Trash2 />
      </ActionButton>
    </div>
  );
}

export default async function EditProfilePage() {
  const user = await requireOnboardedUser();
  const [[profile], categories, experienceRows, educationRows, projectRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    getActiveCategories(),
    db.select().from(experiences).where(eq(experiences.userId, user.id)).orderBy(desc(experiences.isCurrent), desc(experiences.startDate)),
    db.select().from(educations).where(eq(educations.userId, user.id)).orderBy(desc(educations.endYear)),
    db.select().from(projects).where(eq(projects.userId, user.id)).orderBy(desc(projects.createdAt)),
  ]);
  if (!profile) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Edit profile"
        description="This is what members, recruiters and search engines see. Privacy controls live in Settings."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/u/${user.username}`}>View profile</Link>
          </Button>
        }
      />

      <Section title="Profile">
        <ActionForm action={updateProfileAction} className="space-y-5">
          <FormError />
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <ImageUpload name="avatarFileId" kind="avatar" label="Photo" shape="circle" initialFileId={profile.avatarFileId} />
            <ImageUpload name="coverFileId" kind="cover" label="Cover image" shape="wide" initialFileId={profile.coverFileId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Name" name="name" required maxLength={80} defaultValue={user.name} autoComplete="name" />
            <InputField label="Handle" name="username" required maxLength={30} defaultValue={user.username} hint="Your profile address: /u/handle. Changing it breaks old links." />
          </div>
          <InputField label="Headline" name="headline" optional maxLength={LIMITS.headline} defaultValue={profile.headline ?? ""} placeholder="Penetration Tester · Web & API security · OSCP" />
          <TextareaField label="About" name="bio" optional rows={6} maxLength={LIMITS.bio} defaultValue={profile.bio ?? ""} placeholder="What you work on, what you are learning, and what you are looking for." />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Current role" name="currentTitle" optional maxLength={100} defaultValue={profile.currentTitle ?? ""} />
            <InputField label="Company or institution" name="currentCompany" optional maxLength={100} defaultValue={profile.currentCompany ?? ""} />
            <InputField label="City" name="location" optional maxLength={100} defaultValue={profile.location ?? ""} />
            <SelectField label="Country" name="country" optional placeholder="Select a country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={profile.country ?? ""} />
            <InputField label="Years of experience" name="yearsExperience" type="number" min={0} max={60} optional defaultValue={profile.yearsExperience ?? ""} />
          </div>
          <ChipGroup legend="Domains" name="domains" hint="Up to eight. They shape your feed and where you appear in discovery." options={categories.map((c) => ({ value: c.slug, label: c.name }))} selected={profile.domains} />
          <InputField label="Skills" name="skills" optional list="skill-options" defaultValue={profile.skills.map(skillLabel).join(", ")} hint={`Separate with commas. Up to ${LIMITS.skillsPerProfile}.`} />
          <SkillDatalist />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Website" name="website" type="url" optional maxLength={2048} defaultValue={profile.website ?? ""} placeholder="https://" />
            <InputField label="GitHub" name="githubUrl" type="url" optional maxLength={2048} defaultValue={profile.githubUrl ?? ""} placeholder="https://github.com/you" />
            <InputField label="LinkedIn" name="linkedinUrl" type="url" optional maxLength={2048} defaultValue={profile.linkedinUrl ?? ""} placeholder="https://www.linkedin.com/in/you" />
            <InputField label="X / Twitter" name="twitterUrl" type="url" optional maxLength={2048} defaultValue={profile.twitterUrl ?? ""} placeholder="https://x.com/you" />
          </div>

          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-[13px] font-semibold">Job preferences</legend>
            <CheckboxField label="I am open to work" name="openToWork" defaultChecked={profile.openToWork} />
            <SelectField
              label="Who can see that you are open to work"
              name="openToWorkVisibility"
              options={OPEN_TO_WORK_VISIBILITIES.map((o) => ({ value: o.value, label: `${o.label} — ${o.hint}` }))}
              defaultValue={profile.openToWorkVisibility}
            />
            <ChipGroup legend="Employment types" name="preferredEmploymentTypes" options={EMPLOYMENT_TYPES} selected={profile.preferredEmploymentTypes} />
            <ChipGroup legend="Work arrangement" name="preferredArrangements" options={WORK_ARRANGEMENTS} selected={profile.preferredArrangements} />
            <InputField label="Preferred locations" name="preferredLocations" optional defaultValue={profile.preferredLocations.join(", ")} placeholder="Bengaluru, Hyderabad, Remote" />
          </fieldset>

          <div className="flex justify-end border-t pt-4">
            <SubmitButton>Save profile</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      <Section
        title="Experience"
        action={
          <EntryDialog trigger={<><Plus /> Add</>} title="Add experience" action={saveExperienceAction}>
            <ExperienceFields />
          </EntryDialog>
        }
      >
        {experienceRows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Add roles, internships and freelance work.</p>
        ) : (
          <ul className="divide-y">
            {experienceRows.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{item.title}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {item.company} · {formatDate(item.startDate, "monthYear")} – {item.isCurrent || !item.endDate ? "Present" : formatDate(item.endDate, "monthYear")}
                  </p>
                </div>
                <RowActions
                  kind="experience"
                  id={item.id}
                  edit={
                    <EntryDialog trigger={<Pencil />} aria-label="Edit" variant="ghost" buttonSize="icon-sm" title="Edit experience" action={saveExperienceAction}>
                      <ExperienceFields item={item} />
                    </EntryDialog>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Education"
        action={
          <EntryDialog trigger={<><Plus /> Add</>} title="Add education" action={saveEducationAction}>
            <EducationFields />
          </EntryDialog>
        }
      >
        {educationRows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Add degrees, diplomas and bootcamps.</p>
        ) : (
          <ul className="divide-y">
            {educationRows.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{item.school}</p>
                  <p className="text-[13px] text-muted-foreground">{[item.degree, item.field, [item.startYear, item.endYear].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}</p>
                </div>
                <RowActions
                  kind="education"
                  id={item.id}
                  edit={
                    <EntryDialog trigger={<Pencil />} aria-label="Edit" variant="ghost" buttonSize="icon-sm" title="Edit education" action={saveEducationAction}>
                      <EducationFields item={item} />
                    </EntryDialog>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Projects"
        action={
          <EntryDialog trigger={<><Plus /> Add</>} title="Add project" action={saveProjectAction}>
            <ProjectFields />
          </EntryDialog>
        }
      >
        {projectRows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Show tools, labs and research you have built.</p>
        ) : (
          <ul className="divide-y">
            {projectRows.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{item.name}</p>
                  {item.description ? <p className="line-clamp-2 text-[13px] text-muted-foreground">{item.description}</p> : null}
                </div>
                <RowActions
                  kind="project"
                  id={item.id}
                  edit={
                    <EntryDialog trigger={<Pencil />} aria-label="Edit" variant="ghost" buttonSize="icon-sm" title="Edit project" action={saveProjectAction}>
                      <ProjectFields item={item} />
                    </EntryDialog>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
