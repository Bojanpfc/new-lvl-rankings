import { useState } from 'react';
import { Trophy, Shield, BarChart3, Zap, History } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import SubmitPage from '@/pages/SubmitPage';
import AdminPage from '@/pages/AdminPage';
import RankingPage from '@/pages/RankingPage';
import HistoryPage from '@/pages/HistoryPage';

type Tab = 'submit' | 'admin' | 'ranking' | 'history';

function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const savedTab = sessionStorage.getItem('fc-mobile-tab');
    return savedTab === 'admin' || savedTab === 'ranking' || savedTab === 'history' ? savedTab : 'submit';
  });

  const changeTab = (nextTab: Tab) => {
    sessionStorage.setItem('fc-mobile-tab', nextTab);
    setTab(nextTab);
  };

  const tabs: { id: Tab; label: string; icon: typeof Trophy }[] = [
    { id: 'submit', label: 'Submit', icon: Zap },
    { id: 'admin', label: 'Admin', icon: Shield },
    { id: 'ranking', label: 'Ranking', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#050914] text-white">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% -10%, rgba(36,135,255,.18), transparent 40%), radial-gradient(circle at 100% 40%, rgba(0,198,255,.06), transparent 30%)',
        }}
      />

      <header className="relative z-10 border-b border-white/[.06] bg-[#050914]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2487ff] to-[#00c6ff] flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-black text-sm tracking-wider leading-none">FC MOBILE</div>
              <div className="text-[10px] text-slate-400 tracking-widest mt-0.5">LVL SYSTEM</div>
            </div>
          </div>

          <nav className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => changeTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  tab === id
                    ? 'bg-gradient-to-r from-[#2487ff] to-[#00c6ff] text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <ErrorBoundary key={tab} onError={(err) => console.error('Page error:', err)}>
          {tab === 'submit' && <SubmitPage />}
          {tab === 'admin' && <AdminPage />}
          {tab === 'ranking' && <RankingPage />}
          {tab === 'history' && <HistoryPage />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
