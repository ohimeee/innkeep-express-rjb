import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

// A link that knows whether it is the current page. react-router ships its own
// NavLink, but this keeps the prop names the original used so the call sites
// port over untouched.
export const NavLink: React.FC<NavLinkProps> = ({
  href,
  children,
  className = "",
  activeClassName = "font-semibold text-orange-500",
  inactiveClassName = "text-gray-600 hover:text-orange-500",
}) => {
  const { pathname } = useLocation();

  const isActive = pathname === href;

  return (
    <Link
      to={href}
      className={`transition-all duration-200 ${className} ${
        isActive ? activeClassName : inactiveClassName
      }`}
    >
      {children}
    </Link>
  );
};
