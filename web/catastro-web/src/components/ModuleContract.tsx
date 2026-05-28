type ModuleContractTone = "cyan" | "green" | "amber" | "red" | "purple" | "neutral";

type ModuleContractItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: ModuleContractTone;
};

type ModuleContractBadge = {
  label: string;
  tone?: ModuleContractTone;
};

function contractToneClass(tone: ModuleContractTone = "neutral") {
  switch (tone) {
    case "cyan":
      return "contract-cyan";
    case "green":
      return "contract-green";
    case "amber":
      return "contract-amber";
    case "red":
      return "contract-red";
    case "purple":
      return "contract-purple";
    default:
      return "contract-neutral";
  }
}

export default function ModuleContract({
  title = "Contrato del módulo",
  description,
  items,
  badges = [],
  note,
}: {
  title?: string;
  description?: string;
  items: ModuleContractItem[];
  badges?: ModuleContractBadge[];
  note?: string | null;
}) {
  return (
    <section className="cat-module-contract mt-6 rounded-[28px] p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="cat-module-contract-eyebrow">Contrato operacional</div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--cat-text)]">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cat-text-muted)]">{description}</p>
          ) : null}
        </div>

        {badges.length ? (
          <div className="flex flex-wrap gap-2 xl:max-w-[28rem] xl:justify-end">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`cat-module-contract-badge ${contractToneClass(badge.tone)}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="cat-module-contract-grid mt-5">
        {items.map((item) => (
          <div
            key={item.label}
            className={`cat-module-contract-item ${contractToneClass(item.tone)}`}
          >
            <div className="cat-module-contract-label">{item.label}</div>
            <div className="cat-module-contract-value">{item.value}</div>
            {item.hint ? <div className="cat-module-contract-hint">{item.hint}</div> : null}
          </div>
        ))}
      </div>

      {note ? (
        <div className="cat-module-contract-note mt-5">
          {note}
        </div>
      ) : null}
    </section>
  );
}
