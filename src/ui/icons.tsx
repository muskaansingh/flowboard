import type { SVGProps } from 'react';

/** Minimal inline icon set (stroke icons, 24px grid) — avoids an icon library dependency. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const make = (paths: React.ReactNode, displayName: string) => {
  const Icon = ({ size = 16, className, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {paths}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
};

export const ChevronRight = make(<path d="m9 18 6-6-6-6" />, 'ChevronRight');
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />, 'ChevronDown');
export const ChevronUpDown = make(<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />, 'ChevronUpDown');
export const Plus = make(<path d="M12 5v14M5 12h14" />, 'Plus');
export const X = make(<path d="M18 6 6 18M6 6l12 12" />, 'X');
export const Check = make(<path d="M20 6 9 17l-5-5" />, 'Check');
export const Search = make(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 'Search');
export const Space = make(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>, 'Space');
export const Folder = make(<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />, 'Folder');
export const ListIcon = make(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 'ListIcon');
export const Grip = make(<><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>, 'Grip');
export const More = make(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>, 'More');
export const Board = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>, 'Board');
export const Rows = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18" /></>, 'Rows');
export const Calendar = make(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>, 'Calendar');
export const Flag = make(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></>, 'Flag');
export const Lock = make(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 'Lock');
export const Users = make(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>, 'Users');
export const Trash = make(<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />, 'Trash');
export const Archive = make(<><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>, 'Archive');
export const Undo = make(<path d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" />, 'Undo');
export const Activity = make(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />, 'Activity');
export const Alert = make(<><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></>, 'Alert');
export const Settings = make(<><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>, 'Settings');
export const Pencil = make(<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />, 'Pencil');
export const Share = make(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>, 'Share');
export const ArrowUp = make(<path d="m5 12 7-7 7 7M12 19V5" />, 'ArrowUp');
export const ArrowDown = make(<path d="M12 5v14M19 12l-7 7-7-7" />, 'ArrowDown');
export const Subtasks = make(<path d="M4 4v10a2 2 0 0 0 2 2h8M4 9h10M18 13l3 3-3 3M18 6l3 3-3 3" />, 'Subtasks');
export const Info = make(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>, 'Info');
export const CheckCircle = make(<><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m9 11 3 3L22 4" /></>, 'CheckCircle');
export const Move = make(<path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />, 'Move');
export const PanelLeft = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>, 'PanelLeft');
export const ListBullet = make(<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />, 'ListBullet');
export const ListOrdered = make(<path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />, 'ListOrdered');
export const ListChecks = make(<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />, 'ListChecks');
export const Quote = make(<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />, 'Quote');
export const Code = make(<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />, 'Code');
export const LinkIcon = make(<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />, 'LinkIcon');
export const Bookmark = make(<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />, 'Bookmark');
export const Bug = make(<><rect x="8" y="6" width="8" height="14" rx="4" /><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2" /></>, 'Bug');
export const Chat = make(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, 'Chat');
export const Copy = make(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, 'Copy');
export const Tag = make(<><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><path d="M7 7h.01" /></>, 'Tag');
export const Refresh = make(<path d="M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16M16 16h5v5" />, 'Refresh');
