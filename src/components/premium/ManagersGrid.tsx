interface Manager {
  id: string;
  displayName: string;
  isReady: boolean;
  isHost?: boolean;
}

interface ManagersGridProps {
  managers: Manager[];
  maxManagers?: number;
}

export default function ManagersGrid({ managers, maxManagers = 8 }: ManagersGridProps) {
  const emptySlots = maxManagers - managers.length;
  
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6 backdrop-blur-sm hover-lift">
      <h3 className="text-lg font-semibold text-[var(--fg0)] mb-4">
        Managers ({managers.length}/{maxManagers})
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {managers.map((manager) => (
          <div
            key={manager.id}
            className="relative bg-[var(--glass)] border border-[var(--stroke)] rounded-lg p-3 transition-all duration-200 hover:border-[var(--neon-blue)] hover:shadow-md"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  manager.isReady
                    ? "bg-[var(--success)] shadow-[0_0_6px_var(--success)]"
                    : "bg-[var(--fg2)]"
                }`}
              />
              {manager.isHost && (
                <div className="px-1.5 py-0.5 bg-[var(--neon-blue)] rounded text-xs text-white font-medium">
                  HOST
                </div>
              )}
            </div>
            
            <div className="text-sm font-medium text-[var(--fg0)] truncate">
              {manager.displayName}
            </div>
            
            <div className="text-xs text-[var(--fg2)]">
              {manager.isReady ? "Ready" : "Not ready"}
            </div>
          </div>
        ))}
        
        {Array.from({ length: emptySlots }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="bg-[var(--glass)] border border-dashed border-[var(--stroke)] rounded-lg p-3 flex items-center justify-center min-h-[60px]"
          >
            <div className="text-xs text-[var(--fg2)] text-center">
              Open Slot
            </div>
          </div>
        ))}
      </div>
      
      {managers.length === 0 && (
        <div className="text-center py-8 text-[var(--fg2)]">
          No managers connected yet
        </div>
      )}
    </div>
  );
}
