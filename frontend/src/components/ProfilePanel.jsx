import { getUiText } from "../i18n";

function ProfilePanel({
  form,
  user,
  loading,
  error,
  notice,
  onChange,
  onSubmit,
  onReset,
  language = "en"
}) {
  const text = getUiText(language);

  return (
    <section className="profile-panel">
      <div className="profile-panel__header">
        <div>
          <p className="profile-panel__eyebrow">{text.profile.eyebrow}</p>
          <h2>{user ? text.profile.welcome(user.name) : text.profile.title}</h2>
          <p className="profile-panel__copy">{text.profile.copy}</p>
        </div>
        {user && (
          <button type="button" className="profile-panel__ghost-button" onClick={onReset}>
            {text.profile.useAnotherEmail}
          </button>
        )}
      </div>

      {notice && <div className="banner banner--success banner--animated">{notice}</div>}
      {error && <div className="banner banner--error">{error}</div>}

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
              <strong>{user.phone}</strong>
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
        <form className="profile-panel__form" onSubmit={onSubmit}>
          <div className="profile-panel__grid">
            <label>
              <span>{text.profile.name}</span>
              <input
                name="name"
                type="text"
                placeholder={text.profile.fullNamePlaceholder}
                value={form.name}
                onChange={onChange}
              />
            </label>

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
              <span>{text.profile.phone}</span>
              <input
                name="phone"
                type="tel"
                placeholder={text.profile.phonePlaceholder}
                value={form.phone}
                onChange={onChange}
              />
            </label>

            <label>
              <span>{text.profile.address}</span>
              <input
                name="address"
                type="text"
                placeholder={text.profile.addressPlaceholder}
                value={form.address}
                onChange={onChange}
              />
            </label>
          </div>

          <p className="profile-panel__hint">{text.profile.formHint}</p>

          <button type="submit" className="profile-panel__submit" disabled={loading}>
            {loading ? text.profile.loading : text.profile.submit}
          </button>
        </form>
      )}
    </section>
  );
}

export default ProfilePanel;
