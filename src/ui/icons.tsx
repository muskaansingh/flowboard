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
export const Refresh = make(<path d="M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16M16 16h5v5" />, 'Refresh');
