'use client';

import { useState } from 'react';

// One id per form instance, made in the browser: a double submit inserts nothing new. Only
// for forms that mount on the client (inside a dialog); server-rendered forms get theirs as a prop.
export default function FormId({ name = 'id' }: { name?: string }) {
  const [id] = useState(() => crypto.randomUUID());
  return <input type="hidden" name={name} value={id} />;
}
