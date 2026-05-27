import { useState } from 'react';
import { CheckSquare, Heart, Droplets } from 'lucide-react';
import CheckList from './CheckList';
import SchedaControlloDefibrillatore from './SchedaControlloDefibrillatore';
import CheckListGlucometro from './CheckListGlucometro';

type Tab = 'defibrillatore' | 'apparecchiature' | 'glucometro';

export default function CheckListHub() {
  const [activeTab, setActiveTab] = useState<Tab>('defibrillatore');

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    {
      key: 'defibrillatore',
      label: 'Check List Defibrillatore',
      icon: <CheckSquare size={18} />,
    },
    {
      key: 'apparecchiature',
      label: 'Scheda Controllo Apparecchiature Elettromedicali',
      icon: <Heart size={18} />,
    },
    {
      key: 'glucometro',
      label: 'Check List Glucometro',
      icon: <Droplets size={18} />,
    },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          borderBottom: '2px solid var(--gray-200)',
          paddingBottom: '0',
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontSize: '0.92rem',
              fontWeight: activeTab === tab.key ? '700' : '400',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--gray-500)',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenuto tab attivo */}
      {activeTab === 'defibrillatore' && <CheckList />}
      {activeTab === 'apparecchiature' && <SchedaControlloDefibrillatore />}
      {activeTab === 'glucometro' && <CheckListGlucometro />}
    </div>
  );
}
