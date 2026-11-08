'use client';

import type { ProjectStage } from '@/db/schema';
import { STAGE_LABELS } from '../labels';
import { Field, FieldRow, Input, Select, Textarea } from '../ui';

const STAGES: ProjectStage[] = ['discovery', 'design', 'development', 'review', 'launched', 'on_hold'];

export interface ProjectFieldValues {
  name: string;
  summary: string;
  stage: ProjectStage;
  targetLaunch: string;
}

// Shared by the new project form and the settings tab
export default function ProjectFields({ saved, clientName }: { saved: ProjectFieldValues; clientName?: string }) {
  return (
    <>
      <Field label="Project name" name="name" saved={saved.name} hint="The client sees this at the top of every page.">
        {(control) => (
          <Input
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={120}
            autoComplete="off"
            required
          />
        )}
      </Field>
      <Field
        label="Summary"
        name="summary"
        optional
        saved={saved.summary}
        hint={`One or two sentences on what we're making${clientName ? ` for ${clientName}` : ''}. Shown on the project's overview.`}
      >
        {(control) => (
          <Textarea
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            rows={3}
            maxLength={2000}
          />
        )}
      </Field>
      <FieldRow>
        <Field label="Stage" name="stage" saved={saved.stage}>
          {(control) => (
            <Select
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Target launch" name="targetLaunch" optional saved={saved.targetLaunch}>
          {(control) => (
            <Input
              id={control.id}
              name={control.name}
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
            />
          )}
        </Field>
      </FieldRow>
    </>
  );
}
