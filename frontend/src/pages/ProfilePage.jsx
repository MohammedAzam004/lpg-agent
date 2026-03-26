function ProfilePage({ header, content, alerts }) {
  return (
    <div className="page-stack">
      {header}
      {content}
      {alerts}
    </div>
  );
}

export default ProfilePage;
