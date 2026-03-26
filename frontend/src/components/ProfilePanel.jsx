import { getUiText } from "../i18n";

function ProfilePanel({
  form,
  user,
  isAdmin = false,
  loading,
  error,
  notice,
  onChange,
  onSubmit,
  onReset,
  language = "en",
  authMode = "login",
  onAuthModeChange,
  onGoogleLogin,
  googleLoading = false,
  otpRequired = false,
  otpCode = "",
  onOtpChange,
  onSendOtp,
  onVerifyOtp,
  otpSending = false,
  otpVerifying = false,
  authGreeting = "",
  locationStatus = ""
}) {
  const text = getUiText(language);
  const isRegisterMode = authMode === "register";

  return (
    <section className="profile-panel profile-panel--auth">
      <div className="profile-panel__header">
        <div>
          <p className="profile-panel__eyebrow">{text.profile.eyebrow}</p>
          <div className="profile-panel__title-row">
            <h2>{user ? text.profile.welcome(user.name) : text.profile.title}</h2>
            {user && isAdmin && (
              <span className="profile-panel__role-badge">{text.profile.adminBadge || "Admin"}</span>
            )}
          </div>
          <p className="profile-panel__copy">
            {user ? (authGreeting || text.profile.copy) : (text.profile.authCopy || text.profile.copy)}
          </p>
        </div>
        {user && (
          <button type="button" className="profile-panel__ghost-button" onClick={onReset}>
            {text.profile.useAnotherEmail}
          </button>
        )}
      </div>

      {notice && <div className="banner banner--success banner--animated">{notice}</div>}
      {error && <div className="banner banner--error">{error}</div>}
      {locationStatus && !error && <div className="banner banner--info banner--animated">{locationStatus}</div>}

      {user ? (
        <div className="profile-panel__logged-in">
          <div className="profile-panel__details">
            <div>
              <span>{text.profile.name}</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span>{text.profile.email}</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>{text.profile.phone}</span>
              <strong>{user.phone || "N/A"}</strong>
            </div>
            <div>
              <span>{text.profile.address}</span>
              <strong>{user.address || "N/A"}</strong>
            </div>
            <div>
              <span>{text.profile.joined}</span>
              <strong>{new Date(user.createdAt).toLocaleString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN")}</strong>
            </div>
          </div>

          <div className="profile-panel__note">
            <p className="profile-panel__eyebrow">{text.profile.nextStep}</p>
            <h3>{text.profile.notificationTitle}</h3>
            <p className="profile-panel__hint">{text.profile.notificationHint}</p>
          </div>
        </div>
      ) : (
        <div className="profile-panel__auth-layout">
          <div className="profile-panel__auth-switch">
            <button
              type="button"
              className={authMode === "login" ? "profile-panel__mode profile-panel__mode--active" : "profile-panel__mode"}
              onClick={() => onAuthModeChange?.("login")}
            >
              {text.profile.loginTab || "Login"}
            </button>
            <button
              type="button"
              className={authMode === "register" ? "profile-panel__mode profile-panel__mode--active" : "profile-panel__mode"}
              onClick={() => onAuthModeChange?.("register")}
            >
              {text.profile.registerTab || "Register"}
            </button>
          </div>

          {!otpRequired ? (
            <>
              <form className="profile-panel__form" onSubmit={onSubmit}>
                <div className="profile-panel__grid">
                  {isRegisterMode && (
                    <label>
                      <span>{text.profile.name}</span>
                      <input
                        name="name"
                        type="text"
                        placeholder={text.profile.fullNamePlaceholder}
                        value={form.name}
                        onChange={onChange}
                        required={isRegisterMode}
                      />
                    </label>
                  )}

                  <label>
                    <span>{text.profile.email}</span>
                    <input
                      name="email"
                      type="email"
                      placeholder={text.profile.emailPlaceholder}
                      value={form.email}
                      onChange={onChange}
                      required
                    />
                  </label>

                  <label>
                    <span>{text.profile.passwordLabel || "Password"}</span>
                    <input
                      name="password"
                      type="password"
                      placeholder={text.profile.passwordPlaceholder || "Enter password"}
                      value={form.password || ""}
                      onChange={onChange}
                      required
                    />
                  </label>

                  {isRegisterMode && (
                    <>
                      <label>
                        <span>{text.profile.phone}</span>
                        <input
                          name="phone"
                          type="tel"
                          placeholder={text.profile.phonePlaceholder}
                          value={form.phone}
                          onChange={onChange}
                        />
                      </label>

                      <label className="profile-panel__grid-span-two">
                        <span>{text.profile.address}</span>
                        <input
                          name="address"
                          type="text"
                          placeholder={text.profile.addressPlaceholder}
                          value={form.address}
                          onChange={onChange}
                        />
                      </label>
                    </>
                  )}
                </div>

                <p className="profile-panel__hint">{text.profile.firebaseHint || text.profile.formHint}</p>

                <div className="profile-panel__auth-actions">
                  <button type="submit" className="profile-panel__submit" disabled={loading || googleLoading}>
                    {loading
                      ? (text.profile.loading || "Please wait...")
                      : isRegisterMode
                        ? (text.profile.registerSubmit || "Create account")
                        : (text.profile.loginSubmit || "Login")}
                  </button>

                  <button
                    type="button"
                    className="profile-panel__google-button"
                    onClick={onGoogleLogin}
                    disabled={loading || googleLoading}
                  >
                    {googleLoading ? (text.profile.googleLoading || "Connecting Google...") : (text.profile.googleSubmit || "Continue with Google")}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="profile-panel__otp-card">
              <p className="profile-panel__eyebrow">{text.profile.otpEyebrow || "Verify Login"}</p>
              <h3>{text.profile.otpTitle || "Enter email OTP"}</h3>
              <p className="profile-panel__hint">{text.profile.otpCopy || "We sent a 6-digit OTP to your email. Enter it below to continue."}</p>

              <label className="profile-panel__otp-field">
                <span>{text.profile.otpLabel || "6-digit OTP"}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={text.profile.otpPlaceholder || "123456"}
                  value={otpCode}
                  onChange={(event) => onOtpChange?.(event.target.value)}
                />
              </label>

              <div className="profile-panel__otp-actions">
                <button
                  type="button"
                  className="profile-panel__submit"
                  disabled={otpVerifying}
                  onClick={onVerifyOtp}
                >
                  {otpVerifying ? (text.profile.otpVerifying || "Verifying OTP...") : (text.profile.otpSubmit || "Verify OTP")}
                </button>
                <button
                  type="button"
                  className="profile-panel__ghost-button"
                  disabled={otpSending}
                  onClick={onSendOtp}
                >
                  {otpSending ? (text.profile.otpSending || "Sending OTP...") : (text.profile.otpResend || "Resend OTP")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default ProfilePanel;
