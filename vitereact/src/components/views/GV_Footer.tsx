import React from "react";
import { Link, useLocation } from "react-router-dom";

// 1. Static data as per config/datamap

const policy_links: { label: string; url: string }[] = [
  { label: "About", url: "/info/about" },
  { label: "Privacy Policy", url: "/info/privacy" },
  { label: "Terms of Service", url: "/info/terms" },
  { label: "Contact", url: "/info/contact" },
];

type SocialIcon = "instagram" | "facebook" | "twitter";

const social_links: { icon: SocialIcon; url: string }[] = [
  { icon: "instagram", url: "https://instagram.com/beachstay" },
  { icon: "facebook", url: "https://facebook.com/beachstay" },
  { icon: "twitter", url: "https://twitter.com/beachstay" },
];

const copyright = "© 2024 BeachStay Villas";

// 2. SVG Icons - minimal, inline
const SocialSVG: React.FC<{ icon: SocialIcon; className?: string }> = ({
  icon,
  className = "w-6 h-6",
}) => {
  switch (icon) {
    case "instagram":
      return (
        <svg
          className={className}
          aria-label="Instagram"
          fill="none"
          viewBox="0 0 24 24"
          stroke="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="22"
            height="22"
            x="1"
            y="1"
            rx="6"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <circle
            cx="12"
            cy="12"
            r="5"
            stroke="#374151"
            strokeWidth="2"
            fill="none"
          />
          <circle
            cx="17.5"
            cy="6.5"
            r="1"
            fill="#374151"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg
          className={className}
          aria-label="Facebook"
          viewBox="0 0 24 24"
          fill="none"
          stroke="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="22"
            height="22"
            x="1"
            y="1"
            rx="6"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <path
            d="M16.45 8.97h-1.34a.2.2 0 0 0-.21.22v1.29h1.41a.18.18 0 0 1 .19.19l-.04 1.59a.18.18 0 0 1-.16.2h-1.4v4.32c0 .1-.08.18-.18.18h-1.7a.18.18 0 0 1-.18-.18v-4.32h-1.07a.18.18 0 0 1-.18-.18v-1.53c0-.1.08-.18.18-.18h1.07v-1.08c0-1.08.63-2.04 2.16-2.04h1.35c.1 0 .18.08.18.18v1.46c0 .1-.08.18-.18.18z"
            fill="#374151"
          />
        </svg>
      );
    case "twitter":
      return (
        <svg
          className={className}
          aria-label="Twitter"
          viewBox="0 0 24 24"
          fill="none"
          stroke="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="22"
            height="22"
            x="1"
            y="1"
            rx="6"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
          />
          <path
            d="M17.75 9.05c-.39.17-.8.28-1.23.33a2.06 2.06 0 0 0 .91-1.14c-.4.24-.85.41-1.32.5A2.07 2.07 0 0 0 9.7 10.49c-2.13 0-3.33-1.62-3.35-1.66a2.03 2.03 0 0 0 .91 2.76c-.37-.01-.72-.1-1.03-.28 0 1.1.78 2.02 1.82 2.24a2.1 2.1 0 0 1-.92.03c.26.8 1.01 1.38 1.9 1.39a4.16 4.16 0 0 1-2.56.88c-.17 0-.34-.01-.5-.03a5.83 5.83 0 0 0 3.17.93c3.8 0 5.89-3.15 5.89-5.89v-.27c.4-.28.75-.63 1.02-1.02z"
            fill="#374151"
          />
        </svg>
      );
    default:
      return null;
  }
};

// 3. Actual component
const GV_Footer: React.FC = () => {
  const location = useLocation();

  // Handler for opening contact modal or redirecting as per app architecture
  const openContact = React.useCallback(() => {
    // Implement modal open here; fallback to redirect
    if (typeof window !== 'undefined') {
      window.location.assign('/info/contact');
    }
  }, []);

  return (
    <footer
      className="w-full bg-gray-50 border-t border-gray-200 py-4 px-4 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 text-sm z-10"
      role="contentinfo"
    >
      {/* Policy/Info/Contact links */}
      <nav className="flex flex-wrap gap-4 md:gap-6 items-center mb-2 md:mb-0">
        {policy_links.map((pl) => {
          const isActive = location.pathname.toLowerCase().startsWith(pl.url.toLowerCase());
          if (pl.label === 'Contact') {
            return (
              <button
                key={pl.label}
                type="button"
                className={
                  `text-gray-700 hover:text-blue-600 font-medium transition-colors bg-transparent border-none p-0 m-0 cursor-pointer ` +
                  (isActive ? 'underline underline-offset-2 text-blue-600' : '')
                }
                aria-label={pl.label}
                onClick={openContact}
              >
                {pl.label}
              </button>
            );
          }
          return (
            <Link
              key={pl.label}
              to={pl.url}
              className={
                `text-gray-700 hover:text-blue-600 font-medium transition-colors ` +
                (isActive ? 'underline underline-offset-2 text-blue-600' : '')
              }
              aria-label={pl.label}
            >
              {pl.label}
            </Link>
          );
        })}
      </nav>

      {/* Social media */}
      <div className="flex gap-4 md:gap-5 items-center mb-2 md:mb-0">
        {social_links.map((sl) => (
          <a
            key={sl.icon}
            href={sl.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sl.icon.charAt(0).toUpperCase() + sl.icon.slice(1)}
            className="group"
            title={sl.icon.charAt(0).toUpperCase() + sl.icon.slice(1)}
          >
            <SocialSVG
              icon={sl.icon}
              className="w-6 h-6 text-gray-600 group-hover:text-blue-600 transition-colors"
            />
          </a>
        ))}
      </div>

      {/* Copyright/brand */}
      <div className="text-gray-500 text-xs md:text-sm">
        {copyright}
      </div>
    </footer>
  );
};

export default GV_Footer;