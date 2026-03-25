function CylinderLogo() {
  return (
    <div className="hero-panel__brand" aria-label="LPG Smart Assistant logo">
      <div className="hero-panel__logo">
        <svg viewBox="0 0 96 96" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="cylinderBody" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#39a86e" />
              <stop offset="100%" stopColor="#167d51" />
            </linearGradient>
            <linearGradient id="cylinderTop" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#1f7ae0" />
              <stop offset="100%" stopColor="#1667c1" />
            </linearGradient>
          </defs>

          <rect x="34" y="10" width="28" height="12" rx="4" fill="url(#cylinderTop)" />
          <rect x="28" y="18" width="40" height="10" rx="5" fill="url(#cylinderTop)" />
          <rect x="18" y="24" width="60" height="54" rx="18" fill="url(#cylinderBody)" />
          <rect x="24" y="31" width="48" height="38" rx="14" fill="rgba(255,255,255,0.12)" />
          <path
            d="M48 37c5 6 9 11 9 17a9 9 0 1 1-18 0c0-6 4-11 9-17Z"
            fill="#ffffff"
          />
          <path
            d="M48 44c2.8 3.4 4.9 6.1 4.9 9.6a4.9 4.9 0 1 1-9.8 0c0-3.5 2.1-6.2 4.9-9.6Z"
            fill="#cfe9ff"
          />
        </svg>
      </div>

      <div className="hero-panel__brand-copy">
        <p className="hero-panel__eyebrow">LPG Availability AI Agent</p>
        <span className="hero-panel__brand-title">LPG Smart Assistant</span>
      </div>
    </div>
  );
}

export default CylinderLogo;
