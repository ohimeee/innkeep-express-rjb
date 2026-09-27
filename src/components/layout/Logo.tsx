import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
}

// public/logo.png is rendered from public/logo.svg. The PNG rather than the SVG
// because an SVG loaded through <img> falls back to whatever fonts the viewer
// has, and the wordmark should look the same on every machine.
export const Logo: React.FC<LogoProps> = ({ to = "/" }) => {
  return (
    <Link to={to} className="inline-flex">
      <img src="/logo.png" alt="InnKeep Express" className="h-10 w-auto" />
    </Link>
  );
};
