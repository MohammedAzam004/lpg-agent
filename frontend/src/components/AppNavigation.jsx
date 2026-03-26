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

      <nav className="app-navbar__links" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (
              isActive ? "app-navbar__link app-navbar__link--active" : "app-navbar__link"
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="app-navbar__meta">
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
