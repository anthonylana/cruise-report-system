import { NavLink } from 'react-router';

type NavItem = {
  to: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/upload', label: 'Upload' },
  { to: '/events', label: 'Events' },
];

const BASE = 'rounded-md px-3 py-2 text-sm font-medium transition-colors';
const ACTIVE = 'bg-slate-900 text-white';
const INACTIVE = 'text-slate-600 hover:bg-slate-200 hover:text-slate-900';

export default function NavBar() {
  return (
    <nav className="flex gap-2">
      {NAV_ITEMS.map((item) => (
        // "key" helps React track list items between renders; use something unique and stable.
        <NavLink
          key={item.to}
          to={item.to}
          // className can be a function: NavLink passes { isActive } to it.
          className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
