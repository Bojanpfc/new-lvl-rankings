import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import { History, Trophy, ChevronDown, Loader2, Trash2, Crown } from 'lucide-react';

type FinishedTournament = Tournament & {
  players: (TournamentPlayer & { player: Player | null })[];
};

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tournaments, setTournaments] = useState<FinishedTournament[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const isAdmin = sessionStorage.getItem('fc-mobile-admin-unlocked') === 'true';

  const loadData = useCallback(async () => {
    try {
      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;

      const { data: tpData, error: tpErr } = await supabase
        .from('tournament_players')
        .select('*, player:players(*)');
      if (tpErr) throw tpErr;

      const allTp = (tpData || []) as (TournamentPlayer & { player: Player | null })[];
      const merged: FinishedTournament[] = ((tData || []) as Tournament[]).map((t) => ({
        ...t,
        players: allTp.filter((p) => p.tournament_id === t.id),
      }));

      setTournaments(merged);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setDeletingId(id);
    try {
      const { error: delErr } = await supabase.from('tournaments').delete().eq('id', id);
      if (delErr) throw delErr;
      setTournaments((prev) => prev.filter((t) => t.id !== id));
      if (expandedId === id) setExpandedId(null);
      setPendingDeleteId(null);
    } catch {
      setError('Could not delete this result. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-blue-400" />
        <span className="text-sm tracking-wide">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2487ff] to-[#00c6ff] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <History className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-black tracking-wide">LVL HISTORY</div>
          <div className="text-[10px] text-slate-400 tracking-widest">PAST TOURNAMENT RESULTS</div>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-white/[.06] bg-gradient-to-b from-white/[.03] to-transparent">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <h2 className="text-lg font-black tracking-wide">NO HISTORY YET</h2>
          <p className="text-sm text-slate-400 mt-2">Finished LVLs will show up here.</p>
        </div>
      ) : (
        tournaments.map((t) => {
          const isOpen = expandedId === t.id;
          const resultColor =
            t.result === 'win' ? 'text-green-400' : t.result === 'loss' ? 'text-red-400' : 'text-slate-300';
          const resultLabel =
            t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : t.result === 'draw' ? 'DRAW' : '';
          const scored = t.players.filter((p) => p.score !== null);
          const mvp = scored.length > 0 ? scored.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a)) : null;

          return (
            <div
              key={t.id}
              className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0b1730] to-[#081327] shadow-xl shadow-black/30 overflow-hidden"
            >
              <div
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                className="w-full px-4 py-3.5 text-left cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-400">LVL {t.lvl}</span>
                      {resultLabel && (
                        <span className={`text-[9px] font-extrabold tracking-widest ${resultColor}`}>
                          {resultLabel}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-base font-black mt-1 break-words">{t.opponent}</div>
                    {mvp && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" strokeWidth={2.5} />
                        <span className="text-[9px] font-bold text-yellow-400 truncate">
                          MVP: {mvp.player?.fc_name || mvp.fc_name || 'Unknown'} ({mvp.score})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                        disabled={deletingId === t.id}
                        className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[.05]">
                  {scored.length > 0 ? (
                    <span className="text-[10px] text-slate-500 font-bold">avg {(t.our_score / scored.length).toFixed(2)}</span>
                  ) : (
                    <span />
                  )}
                  <span className={`text-lg font-black tabular-nums ${resultColor}`}>
                    {t.our_score} : {t.opponent_score}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/[.06] p-3 space-y-1.5">
                  {t.players.length === 0 ? (
                    <div className="text-slate-400 text-xs py-3 text-center">No player data.</div>
                  ) : (
                    [...t.players]
                      .sort((a, b) => (b.score || 0) - (a.score || 0))
                      .map((p) => {
                        const isMvp = mvp && p.id === mvp.id;
                        return (
                          <div
                            key={p.id}
                            className={`flex justify-between items-center px-3 py-2 rounded-lg border ${
                              isMvp
                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-[#071126] border-white/[.06]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-bold truncate">
                              {isMvp && <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" strokeWidth={2.5} />}
                              {p.player?.fc_name || p.fc_name || 'Unknown'}
                            </span>
                            <span className={`text-xs font-black flex-shrink-0 ${isMvp ? 'text-yellow-400' : 'text-cyan-400'}`}>
                              {p.score === null ? '—' : `${p.score} goals`}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="text-center text-[9px] text-slate-600 tracking-widest uppercase pt-2">
        FC MOBILE • LVL SYSTEM
      </div>

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => !deletingId && setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/[.08] bg-gradient-to-b from-[#1a0a0a] to-[#0a0505] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-black tracking-wide">DELETE RESULT</h2>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Delete this LVL result permanently? This cannot be undone.
            </p>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setPendingDeleteId(null)}
                disabled={!!deletingId}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-black disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
