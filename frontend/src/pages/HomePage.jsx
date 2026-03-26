function HomePage({
  hero,
  summaries,
  analytics,
  trends,
  storeBoard
}) {
  return (
    <div className="page-stack">
      {hero}
      {summaries}
      {analytics}
      {trends}
      {storeBoard}
    </div>
  );
}

export default HomePage;
