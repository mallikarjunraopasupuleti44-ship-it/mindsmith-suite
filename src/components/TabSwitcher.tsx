export type TabKey = "command" | "team" | "automation";

export function TabSwitcher({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  const tabs: { k: TabKey; label: string }[] = [
    { k: "command", label: "Command Center" },
    { k: "team", label: "Team" },
    { k: "automation", label: "Automation" },
  ];
  return (
    <div className="glass-pill inline-flex p-1">
      {tabs.map((t) => {
        const active = value === t.k;
        return (
          <button
            key={t.k}
            onClick={() => onChange(t.k)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium transition-all",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
