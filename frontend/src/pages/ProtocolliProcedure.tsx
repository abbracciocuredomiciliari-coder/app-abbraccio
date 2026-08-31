import { useState } from 'react';
import Protocolli from './Protocolli';
import Procedure from './Procedure';
import Modulistica from './Modulistica';

type PPTab = 'protocolli' | 'procedure' | 'modulistica';

export default function ProtocolliProcedure() {
  const [activeTab, setActiveTab] = useState<PPTab>('protocolli');

  return (
    <div>
      {/* Tab in alto */}
      <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mb-6 tw-border-b-2 tw-border-slate-200">
        {([
          { key: 'protocolli' as const, label: '📋 Protocolli Sanitari' },
          { key: 'procedure' as const, label: '📄 Procedure Sanitarie' },
          { key: 'modulistica' as const, label: '📝 Modulistica' },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="tw-rounded-t-lg tw-py-2.5 tw-px-4.5 tw-text-[0.95rem] tw-font-semibold tw-cursor-pointer tw-border-none tw--mb-0.5"
            style={{
              backgroundColor: activeTab === tab.key ? '#1e4d8c' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#1e4d8c',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'protocolli' && <Protocolli />}
      {activeTab === 'procedure' && <Procedure />}
      {activeTab === 'modulistica' && <Modulistica />}
    </div>
  );
}
