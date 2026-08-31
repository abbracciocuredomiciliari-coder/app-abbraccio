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
        className="tw-flex tw-flex-wrap tw-gap-1 tw-mb-6 tw-border-b-2 tw-border-slate-200 tw-pb-0"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="tw-flex tw-items-center tw-gap-2 tw-py-3 tw-px-5 tw-bg-transparent tw-border-0 tw-border-b-2 tw-cursor-pointer tw-text-[0.92rem] tw-whitespace-nowrap tw-transition-colors tw--mb-0.5"
            style={{
              borderBottomColor: activeTab === tab.key ? 'var(--primary)' : 'transparent',
              fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--gray-500)',
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
