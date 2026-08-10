interface Manager {
  id: string;
  displayName: string;
  isReady: boolean;
  isHost?: boolean;
  isComputer?: boolean;
}

interface ManagersGridProps {
  managers: Manager[];
  maxManagers?: number;
}

export default function ManagersGrid({ managers, maxManagers = 8 }: ManagersGridProps) {
  const emptySlots = Math.max(0, maxManagers - managers.length);
  
  return (
    <div className="managers-panel">
      <div className="managers-header">
        <div>
          <div className="managers-kicker">Managers</div>
          <h3 className="managers-title">Lobby roster</h3>
        </div>
        <div className="managers-count">{managers.length}/{maxManagers}</div>
      </div>
      
      <div className="managers-grid">
        {managers.map((manager) => (
          <div
            key={manager.id}
            className={`manager-card ${manager.isReady ? "ready" : ""} ${manager.isComputer ? "computer" : ""}`}
          >
            <div className="manager-card-top">
              <span className={`manager-dot ${manager.isReady ? "ready" : ""}`} />
              <div className="manager-tags">
                {manager.isHost ? <span>Host</span> : null}
                {manager.isComputer ? <span>CPU</span> : null}
              </div>
            </div>
            
            <div className="manager-name">{manager.displayName}</div>
            
            <div className="manager-status">{manager.isComputer ? "Automated seat" : manager.isReady ? "Ready" : "Not ready"}</div>
          </div>
        ))}
        
        {Array.from({ length: emptySlots }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="manager-card empty"
          >
            Open slot
          </div>
        ))}
      </div>
      
      {managers.length === 0 && (
        <div className="managers-empty">
          No managers connected yet
        </div>
      )}
    </div>
  );
}
