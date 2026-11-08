'use client';

import { Checkbox, Field, FieldRow, Input, Select, Textarea } from '../ui';
import { STATUS_OPTIONS } from './labels';

export interface MilestoneFieldValues {
  title: string;
  description: string;
  status: string;
  dueDate: string;
  requiresSignoff: boolean;
}

// The fields shared by the add dialog and each row's inline editor
export default function MilestoneFields({ saved, clientFirst }: { saved: MilestoneFieldValues; clientFirst: string }) {
  return (
    <>
      <Field label="Title" name="title" saved={saved.title}>
        {({ id, name, describedBy, invalid, defaultValue }) => (
          <Input
            id={id}
            name={name}
            defaultValue={defaultValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            maxLength={200}
            autoComplete="off"
            required
          />
        )}
      </Field>
      <Field
        label="Description"
        name="description"
        optional
        saved={saved.description}
        hint={`What this step covers and what ${clientFirst} can expect from it.`}
      >
        {({ id, name, describedBy, invalid, defaultValue }) => (
          <Textarea
            id={id}
            name={name}
            defaultValue={defaultValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            maxLength={4000}
          />
        )}
      </Field>
      <FieldRow>
        <Field label="Status" name="status" saved={saved.status}>
          {({ id, name, describedBy, invalid, defaultValue }) => (
            <Select id={id} name={name} defaultValue={defaultValue} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date" name="dueDate" optional saved={saved.dueDate}>
          {({ id, name, describedBy, invalid, defaultValue }) => (
            <Input
              id={id}
              name={name}
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              defaultValue={defaultValue}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </Field>
      </FieldRow>
      <Checkbox
        name="requiresSignoff"
        savedChecked={saved.requiresSignoff}
        hint={`${clientFirst} is asked to initial it once it's Waiting on client and any linked review is approved. Ask for sign-off on the milestone also emails them.`}
      >
        Needs {clientFirst}&apos;s initials when done
      </Checkbox>
    </>
  );
}
