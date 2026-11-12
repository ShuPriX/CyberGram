"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, startTransition, use, useActionState, useEffect, useId, useRef } from "react";
import type * as React from "react";
import type { ActionState } from "@/server/action-utils";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { Checkbox, Input, Label, Select, Textarea } from "./input";
import { Spinner } from "./misc";
import { toast } from "./toast";

type FormContextValue = { state: ActionState; pending: boolean };
const FormContext = createContext<FormContextValue>({ state: null, pending: false });

export const useFormContext = () => use(FormContext);

export function useFieldError(name: string): string | undefined {
  const { state } = use(FormContext);
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

type FormAction<T> = (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;

type ActionFormProps<T> = Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: FormAction<T>;
  /** Called once per successful submission. */
  onSuccess?: (data: T | undefined) => void;
  /** Clear the fields after a successful submission (composers, add-item forms). */
  resetOnSuccess?: boolean;
  /** Re-render the current route's server components after success (lists, counters). */
  refresh?: boolean;
};

/**
 * Binds a server action to a form.
 *
 * Submission is driven manually so that a validation error never clears what the member
 * typed (React resets uncontrolled forms after an `action` completes). Field-level errors,
 * the pending state and success toasts are provided to descendants through context.
 */
export function ActionForm<T = unknown>({ action, onSuccess, resetOnSuccess = false, refresh = false, children, ...props }: ActionFormProps<T>) {
  const [state, dispatch, pending] = useActionState<ActionState<T>, FormData>(action, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionState<T>>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      if (refresh) router.refresh();
      onSuccessRef.current?.(state.data);
    } else {
      // Move focus to the first invalid field so keyboard and screen-reader users land on it.
      const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
    }
  }, [state, resetOnSuccess, refresh, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  return (
    <FormContext value={{ state, pending }}>
      <form ref={formRef} action={dispatch} onSubmit={handleSubmit} {...props}>
        {children}
      </form>
    </FormContext>
  );
}

/** Form-level error summary (rate limits, permission errors, and anything not tied to a field). */
export function FormError({ className }: { className?: string }) {
  const { state } = use(FormContext);
  if (!state || state.ok) return null;
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive-soft-foreground", className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="leading-snug">{state.error}</p>
    </div>
  );
}

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { pending } = use(FormContext);
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}

type FieldBase = {
  label: string;
  name: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: Omit<FieldBase, "name"> & { id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {optional ? <span className="text-xs text-subtle">Optional</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: React.ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function InputField({ label, name, hint, optional, className, ...input }: FieldBase & Omit<React.ComponentProps<"input">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <Input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...input} />
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  optional,
  className,
  ...textarea
}: FieldBase & Omit<React.ComponentProps<"textarea">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <Textarea id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...textarea} />
    </FieldShell>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  label,
  name,
  hint,
  optional,
  className,
  options,
  placeholder,
  ...select
}: FieldBase & Omit<React.ComponentProps<"select">, "name" | "children"> & { options: readonly SelectOption[]; placeholder?: string }) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <Select id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...select}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

/** A labelled checkbox row. Submits "on" when checked. */
export function CheckboxField({
  label,
  name,
  hint,
  className,
  ...input
}: Omit<FieldBase, "optional"> & Omit<React.ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox id={id} name={name} className="mt-0.5" aria-invalid={error ? true : undefined} {...input} />
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium leading-5">
          {label}
        </label>
        {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Inline error for custom controls that do not use one of the Field components. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return <p className={cn("text-xs text-destructive", className)}>{error}</p>;
}
