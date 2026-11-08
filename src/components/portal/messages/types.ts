// What the messages page passes from the server to its client components. The server builds
// these per perspective: the client's copy never carries internal notes or the studio's
// email records.

export type Perspective = 'client' | 'studio';

// Which side of the conversation wrote a message: the project's client or the studio
export type Side = 'client' | 'studio';

export interface MessageView {
  id: string;
  body: string;
  // Studio perspective only ever has these set; the client's query never returns them
  internal: boolean;
  createdAt: string;
  authorId: string;
  authorName: string;
  side: Side;
  // From the other side and newer than the reader's last visit
  unread: boolean;
  // Shown in the browser while it is being sent; never comes from the server
  pending?: boolean;
}

export interface ThreadView {
  messages: MessageView[];
  // Every message the viewer may see, including any older than the loaded window
  total: number;
  // Only the newest messages load by default; ?all=1 loads the whole thread
  limited: boolean;
  firstUnreadId: string | null;
  unreadCount: number;
}

export interface StudioThreadInfo {
  // When the client last opened the conversation
  clientReadAt: string | null;
  // The newest email about this thread that went to the client
  lastEmailedClientAt: string | null;
  // Message emails that could not be sent and have not been followed by one that was
  failedEmails: { id: string; to: string; at: string }[];
  internalCount: number;
}

export interface MessagesViewProps {
  projectId: string;
  perspective: Perspective;
  viewerId: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  // The server's clock at render time, so "Today" means the same before and after hydration
  now: string;
  thread: ThreadView;
  // The signed-in person can write here: false while the studio previews the client's view
  canWrite: boolean;
  // Opening the tab records the visit for the signed-in person (not while previewing)
  canMarkRead: boolean;
  studio: StudioThreadInfo | null;
  maxLength: number;
  // The upload limit, so the client can be told when to send a link instead
  maxUploadMb: number;
}
