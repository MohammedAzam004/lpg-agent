function AdminPage({ header, summaries, content }) {
  return (
    <div className="page-stack">
      {header}
      {summaries}
      {content}
    </div>
  );
}

export default AdminPage;
