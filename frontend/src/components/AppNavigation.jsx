import { useState } from "react";
import { NavLink } from "react-router-dom";
import CylinderLogo from "./CylinderLogo";

function AppNavigation({
  uiText,
  isAuthenticated = false,
  isAdmin = false,
  user = null,
  language = "en",
  onLanguageChange
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationItems = [
    { to: "/", label: uiText.nav?.home || "Home" },
    { to: "/chat", label: uiText.nav?.chat || "Chat" },
    ...(isAuthenticated ? [{ to: "/requests", label: uiText.nav?.requests || "Requests" }] : []),
    ...(isAuthenticated ? [{ to: "/bookings", label: uiText.nav?.bookings || "Bookings" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: uiText.nav?.admin || "Admin" }] : []),
    { to: "/profile", label: uiText.nav?.profile || "Profile" }
  ];

  return (
    <header className="app-navbar">
      <div className="app-navbar__brand">
        <CylinderLogo />
      </div>

      <button
        type="button"
        className="app-navbar__toggle"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((currentState) => !currentState)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        className={menuOpen ? "app-navbar__links app-navbar__links--open" : "app-navbar__links"}
        aria-label="Primary navigation"
      >
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (
              isActive ? "app-navbar__link app-navbar__link--active" : "app-navbar__link"
            )}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className={menuOpen ? "app-navbar__meta app-navbar__meta--open" : "app-navbar__meta"}>
        <div className="app-navbar__language">
          <button
            type="button"
            className={language === "en" ? "app-navbar__lang app-navbar__lang--active" : "app-navbar__lang"}
            onClick={() => onLanguageChange?.("en")}
          >
            {uiText.english || "English"}
          </button>
          <button
            type="button"
            className={language === "hi" ? "app-navbar__lang app-navbar__lang--active" : "app-navbar__lang"}
            onClick={() => onLanguageChange?.("hi")}
          >
            {uiText.hindi || "Hindi"}
          </button>
          <button
            type="button"
            className={language === "te" ? "app-navbar__lang app-navbar__lang--active" : "app-navbar__lang"}
            onClick={() => onLanguageChange?.("te")}
          >
            {uiText.telugu || "Telugu"}
          </button>
        </div>

        {user?.email && (
          <div className="app-navbar__user">
            <span className="app-navbar__user-email">{user.email}</span>
            {isAdmin && (
              <span className="app-navbar__user-role">
                {uiText.profile?.adminBadge || "Admin"}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default AppNavigation;
