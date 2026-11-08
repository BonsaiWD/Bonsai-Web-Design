// What the files page passes from the server to its client components. Removed files and
// who removed them reach the studio's copy only.

export interface ProjectFileView {
  id: string;
  filename: string;
  sizeBytes: number;
  // PDFs and images can open in the browser
  previewable: boolean;
  uploadedAt: string;
  // former: a client this project belonged to before it moved to the current one
  side: 'studio' | 'client' | 'former';
  uploadedByName: string;
  // The viewer uploaded it, so they may remove it
  mine: boolean;
  // What the uploader wrote with it
  note: string | null;
  // Studio perspective only
  removed?: { at: string; byName: string | null } | null;
}
