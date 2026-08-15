export function AppStateScreen({
  title,
  message,
  detail,
}: {
  title: string;
  message: string;
  detail?: string;
}) {
  return (
    <div className="ffaa-bg app-state-screen">
      <div className="app-state-card">
        <div className="app-state-kicker">Fantasy Football · GameHQ</div>
        <h1>{title}</h1>
        <p>{message}</p>
        {detail ? <div className="app-state-detail">{detail}</div> : null}
      </div>
    </div>
  );
}
