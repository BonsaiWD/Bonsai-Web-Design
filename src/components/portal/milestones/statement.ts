// The sentence a client confirms when they initial a milestone. The dialog shows it and the
// server stores it verbatim, so both read it from here.
export function signoffStatement(title: string): string {
  return `I confirm ${title} is complete and approve moving on.`;
}
