import { useRef, useState } from "react";
import { getUiText } from "../i18n";

function formatDate(value, language = "en") {
  if (!value) {
    return "N/A";
  }

  try {
    return new Date(value).toLocaleString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN");
  } catch (error) {
    return value;
  }
}

function getRequestStatusBadge(status = "", text) {
  if (status === "matched") {
    return {
      label: `🟢 ${text.requestStatus.matched}`,
      className: "request-history-card__status request-history-card__status--matched"
    };
  }

  return {
    label: `🟡 ${text.requestStatus.requested}`,
    className: "request-history-card__status request-history-card__status--requested"
  };
}

function AdminPanel({
  language = "en",
  stores = [],
  users = [],
  requests = [],
  insights = null,
  usersLoading = false,
  requestsLoading = false,
  userDeletingId = null,
  requestDeletingId = null,
  form,
  saving = false,
  deletingId = null,
  editingStoreId = null,
  importingPdf = false,
  onChange,
  onImportPdf,
  onSubmit,
  onEdit,
  onDelete,
  onCancelEdit,
  onDeleteUser,
  onDeleteRequest
}) {
  const text = getUiText(language);
  const [selectedPdfFile, setSelectedPdfFile] = useState(null);
  const fileInputRef = useRef(null);

  async function handleImportSubmit(event) {
    event.preventDefault();

    if (typeof onImportPdf !== "function") {
      return;
    }

    try {
      await onImportPdf(selectedPdfFile);
      setSelectedPdfFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      // The parent panel already exposes the import error to the user.
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <div>
          <p className="analytics-panel__eyebrow">{text.admin.adminEyebrow}</p>
          <h2>{text.adminTitle}</h2>
          <p className="admin-panel__copy">{text.adminCopy}</p>
        </div>

        <div className="admin-panel__summary-cards">
          <article className="admin-metric-card">
            <span>{text.admin.totalUsers}</span>
            <strong>{usersLoading ? "..." : users.length}</strong>
          </article>
          <article className="admin-metric-card">
            <span>{text.admin.userRequests}</span>
            <strong>{requestsLoading ? "..." : requests.length}</strong>
          </article>
        </div>
      </div>

      <div className="admin-panel__grid">
        <form className="admin-panel__form" onSubmit={onSubmit}>
          <div className="admin-panel__import">
            <div className="admin-panel__import-copy">
              <p className="analytics-panel__eyebrow">{text.admin.importEyebrow || "PDF Import"}</p>
              <h3>{text.admin.importTitle || "Import LPG data from PDF"}</h3>
              <p>{text.admin.importHint || "Upload Data.pdf or let the backend read a project-root Data.pdf file."}</p>
            </div>

            <div className="admin-panel__import-form">
              <label className="admin-panel__file-field">
                <span>{selectedPdfFile?.name || (text.admin.importFilePlaceholder || "Choose a PDF file")}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => setSelectedPdfFile(event.target.files?.[0] || null)}
                />
              </label>
              <button type="button" className="profile-panel__submit" disabled={importingPdf} onClick={handleImportSubmit}>
                {importingPdf
                  ? (text.admin.importingPdf || "Importing...")
                  : selectedPdfFile
                    ? (text.admin.importPdf || "Import PDF")
                    : (text.admin.importDefaultPdf || "Import Data.pdf")}
              </button>
            </div>
          </div>

          <div className="admin-panel__form-grid">
            <label>
              <span>{text.form.state}</span>
              <input name="state" value={form.state} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.city}</span>
              <input name="city" value={form.city} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.location}</span>
              <input name="location" value={form.location} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.name}</span>
              <input name="name" value={form.name} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.branchCode}</span>
              <input name="branchCode" value={form.branchCode} onChange={onChange} />
            </label>

            <label>
              <span>{text.form.distance}</span>
              <input name="distance" type="number" min="0" step="0.1" value={form.distance} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.price}</span>
              <input name="price" type="number" min="0" step="1" value={form.price} onChange={onChange} required />
            </label>

            <label>
              <span>{text.form.stockCount}</span>
              <input name="stockCount" type="number" min="0" step="1" value={form.stockCount} onChange={onChange} required />
            </label>
          </div>

          <label className="admin-panel__toggle">
            <input
              name="availability"
              type="checkbox"
              checked={form.availability}
              onChange={onChange}
            />
            <span>{text.form.availability}</span>
          </label>

          <div className="admin-panel__actions">
            <button type="submit" className="profile-panel__submit" disabled={saving}>
              {saving ? text.admin.saving : editingStoreId ? text.updateStore : text.addStore}
            </button>
            {editingStoreId && (
              <button type="button" className="profile-panel__ghost-button" onClick={onCancelEdit}>
                {text.cancelEdit}
              </button>
            )}
          </div>
        </form>

        <div className="admin-panel__list">
          {stores.length ? stores.map((store) => (
            <article key={store.id} className="admin-store-card">
              <div>
                <p className="store-card__eyebrow">{store.branchCode || "LPG"}</p>
                <h3>{store.name}</h3>
                <p className="store-card__region">{[store.location, store.city, store.state].filter(Boolean).join(", ")}</p>
                <p className="admin-store-card__meta">Rs. {store.price} | {store.stockCount} {text.cylinders} | {store.distance} km</p>
              </div>
              <div className="admin-store-card__actions">
                <button type="button" className="profile-panel__ghost-button" onClick={() => onEdit(store)}>
                  {text.editStore}
                </button>
                <button
                  type="button"
                  className="admin-store-card__delete"
                  onClick={() => onDelete(store)}
                  disabled={deletingId === store.id}
                >
                  {deletingId === store.id ? text.admin.deleting : text.deleteStore}
                </button>
              </div>
            </article>
          )) : (
            <p className="store-panel__empty">{text.adminEmpty}</p>
          )}
        </div>
      </div>

      <section className="admin-agent-panel">
        <div className="admin-agent-panel__header">
          <div>
            <p className="analytics-panel__eyebrow">{text.admin.agentEyebrow}</p>
            <h3>{text.admin.agentOverview}</h3>
            <p className="admin-panel__copy">{text.admin.agentCopy}</p>
          </div>
        </div>

        <div className="admin-agent-panel__grid">
          {(insights?.overview || []).map((insight) => (
            <article key={insight.id} className="admin-agent-card">
              <p className="admin-agent-card__eyebrow">{insight.name}</p>
              <strong>{insight.value}</strong>
              <p>{insight.detail}</p>
            </article>
          ))}
        </div>

        {!!insights?.highlights?.length && (
          <div className="admin-agent-panel__highlights">
            {insights.highlights.map((highlight) => (
              <article key={highlight.id} className="admin-agent-highlight">
                <span>{highlight.label}</span>
                <strong>{highlight.value}</strong>
                <p>{highlight.detail}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="admin-panel__management">
        <section className="admin-entity-panel">
          <div className="admin-entity-panel__header">
            <div>
              <p className="analytics-panel__eyebrow">{text.admin.usersEyebrow}</p>
              <h3>{text.admin.userManagement}</h3>
              <p className="admin-panel__copy">{text.admin.userManagementCopy}</p>
            </div>
            <strong className="admin-entity-panel__count">{usersLoading ? "..." : text.admin.totalUsersCount(users.length)}</strong>
          </div>

          <div className="admin-entity-panel__list">
            {usersLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article key={`admin-user-skeleton-${index}`} className="admin-entity-card admin-entity-card--skeleton">
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--text" />
                </article>
              ))
            ) : users.length ? (
              users.map((user) => (
                <article key={user.id} className="admin-entity-card">
                  <div className="admin-entity-card__main">
                    <h4>{user.name || text.admin.unnamedUser}</h4>
                    <p>{user.email}</p>
                  </div>
                  <div className="admin-entity-card__meta admin-entity-card__meta--two">
                    <div>
                      <span>{text.profile.phone}</span>
                      <strong>{user.phone || "N/A"}</strong>
                    </div>
                    <div>
                      <span>{text.profile.joined}</span>
                      <strong>{formatDate(user.createdAt, language)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-entity-card__delete"
                    onClick={() => onDeleteUser(user)}
                    disabled={userDeletingId === user.id}
                    aria-label={text.admin.deleteUserConfirm(user.email)}
                  >
                    {userDeletingId === user.id ? "..." : "❌"}
                  </button>
                </article>
              ))
            ) : (
              <p className="store-panel__empty">{text.admin.noRegisteredUsers}</p>
            )}
          </div>
        </section>

        <section className="admin-entity-panel">
          <div className="admin-entity-panel__header">
            <div>
              <p className="analytics-panel__eyebrow">{text.admin.requestsEyebrow}</p>
              <h3>{text.admin.requestTitle}</h3>
              <p className="admin-panel__copy">{text.admin.requestCopy}</p>
            </div>
            <strong className="admin-entity-panel__count">{requestsLoading ? "..." : text.admin.requestCount(requests.length)}</strong>
          </div>

          <div className="admin-entity-panel__list">
            {requestsLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article key={`admin-request-skeleton-${index}`} className="admin-entity-card admin-entity-card--skeleton">
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--text" />
                </article>
              ))
            ) : requests.length ? (
              requests.map((request) => {
                const statusBadge = getRequestStatusBadge(request.status, text);

                return (
                  <article key={request.id} className="admin-entity-card">
                    <div className="admin-entity-card__main">
                      <h4>{request.storeName || request.matchedStoreName || request.query}</h4>
                      <p>{request.userEmail}</p>
                    </div>
                    <div className="admin-entity-card__meta">
                      <div>
                        <span>{text.admin.location}</span>
                        <strong>{[request.storeCity || request.city, request.storeState || request.state].filter(Boolean).join(", ") || "N/A"}</strong>
                      </div>
                      <div>
                        <span>{text.admin.requested}</span>
                        <strong>{formatDate(request.createdAt, language)}</strong>
                      </div>
                      <div>
                        <span>{text.admin.status}</span>
                        <strong className={statusBadge.className}>{statusBadge.label}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-entity-card__delete"
                      onClick={() => onDeleteRequest(request)}
                      disabled={requestDeletingId === request.id}
                      aria-label={text.admin.deleteRequestConfirm}
                    >
                      {requestDeletingId === request.id ? "..." : "❌"}
                    </button>
                  </article>
                );
              })
            ) : (
              <p className="store-panel__empty">{text.admin.noRequests}</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default AdminPanel;
