import { useState } from 'react';
import Protocolli from './Protocolli';
import Procedure from './Procedure';

type PPTab = 'protocolli' | 'procedure';

export default function ProtocolliProcedure() {
  const [activeTab, setActiveTab] = useState<PPTab>('protocolli');

  return (
    <div>
      {/* Tab in alto */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px', borderBottom: '2px solid #e2e8f0' }}>
        {([
          { key: 'protocolli' as const, label: '📋 Protocolli Sanitari' },
          { key: 'procedure' as const, label: '📄 Procedure Sanitarie' },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? '#1e4d8c' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#1e4d8c',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'protocolli' ? <Protocolli /> : <Procedure />}
    </div>
  );
}
