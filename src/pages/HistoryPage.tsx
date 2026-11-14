import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import { History, Trophy, ChevronDown, Loader2, Trash2, Crown } from 'lucide-react';
import PlayerSelect from '@/components/PlayerSelect';

// Neon Violet theme tokens
const CARD = 'border border-[#b48cff]/[.18] shadow-[0_0_24px_rgba(255,79,216,.10)]';

function seasonLabel(id: string) {
  if (id === 'all') return 'All Seasons';
  const n = id.match(/\d+/)?.[0];
  return n ? `Season ${n}` : id;
}

function normSeason(raw: string | null | undefined) {
  const s = (raw || 'season-21').trim().toLowerCase();
  const n = s.match(/\d+/)?.[0];
  return n ? `season-${Number(n)}` : s;
}

const PAGE_SIZE = 1000;

async function fetchAllTournamentPlayers(): Promise<(TournamentPlayer & { player: Player | null })[]> {
  const all: (TournamentPlayer & { player: Player | null })[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('tournament_players')
      .select('*, player:players(*)')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data || []) as (TournamentPlayer & { player: Player | null })[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tournaments, setTournaments] = useState<FinishedTournament[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const isAdmin = sessionStorage.getItem('fc-mobile-admin-unlocked') === 'true';

  const loadData = useCallback(async () => {
    try {
      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;

      const allTp = await fetchAllTournamentPlayers();
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

  const seasonIds = useMemo(() => {
    const ids = Array.from(new Set(tournaments.map((t) => normSeason(t.season))));
    ids.sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] || 0);
      const nb = Number(b.match(/\d+/)?.[0] || 0);
      return nb - na;
    });
    return ids;
  }, [tournaments]);

  // Default to the newest season the first time data loads (same as the Ranking tab).
  useEffect(() => {
    if (season === null && seasonIds.length > 0) {
      setSeason(seasonIds[0]);
    }
  }, [season, seasonIds]);

  const activeSeason = season ?? 'all';

  const seasonOptions = useMemo(
    () => [{ id: 'all', name: 'All Seasons' }, ...seasonIds.map((s) => ({ id: s, name: seasonLabel(s) }))],
    [seasonIds]
  );

  const filteredTournaments = useMemo(() => {
    if (activeSeason === 'all') return tournaments;
    return tournaments.filter((t) => normSeason(t.season) === activeSeason);
  }, [tournaments, activeSeason]);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  // Season summary: W-D-L and the average goals per player result for the selected season
  const stats = useMemo(() => {
    let w = 0, d = 0, l = 0, goals = 0, results = 0;
    filteredTournaments.forEach((t) => {
      if (t.result === 'win') w++;
      else if (t.result === 'loss') l++;
      else if (t.result === 'draw') d++;
      t.players.forEach((p) => {
        if (p.score !== null) {
          goals += p.score;
          results++;
        }
      });
    });
    const tot = w + d + l;
    return { w, d, l, tot, goals, results, avg: results > 0 ? goals / results : 0, winRate: tot > 0 ? Math.round((w / tot) * 100) : 0 };
  }, [filteredTournaments]);

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
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-[#ff4fd8]" />
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-1.5">
      {/* Header (no overflow-hidden here, so the season dropdown can open freely) */}
      <div className={`relative z-20 flex items-center justify-between gap-2 mb-1 rounded-2xl bg-gradient-to-br from-[#3a1b8f] via-[#2a1470] to-[#1a1547] px-3.5 py-3 ${CARD}`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="absolute -right-2 -bottom-9 text-[110px] leading-none opacity-[.14]">⚽</span>
        </div>
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff4fd8] to-[#b66bff] flex items-center justify-center shadow-lg shadow-[#ff4fd8]/30 flex-shrink-0">
            <History className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-black tracking-wide truncate text-white">LVL HISTORY</div>
            <div className="text-[10px] text-white/70 tracking-widest truncate">PAST TOURNAMENT RESULTS</div>
          </div>
        </div>
        <div className="relative z-30 w-32 flex-shrink-0">
          <PlayerSelect value={activeSeason} onChange={setSeason} options={seasonOptions} />
        </div>
      </div>

      {/* Season summary */}
      {filteredTournaments.length > 0 && (
        <div className={`rounded-2xl bg-[#1a1547] px-3.5 py-3 mb-1 ${CARD}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[8px] font-black tracking-[.16em] text-[#9a92c9] uppercase">
              {seasonLabel(activeSeason)} · {filteredTournaments.length} LVLs
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-1.5">
            <div className="rounded-xl bg-[#15113a] border border-[#b48cff]/[.12] py-2 text-center">
              <div className="text-[7px] font-extrabold tracking-[.12em] text-[#9a92c9]">WINS</div>
              <div className="text-xl font-black text-green-400">{stats.w}</div>
            </div>
            <div className="rounded-xl bg-[#15113a] border border-[#b48cff]/[.12] py-2 text-center">
              <div className="text-[7px] font-extrabold tracking-[.12em] text-[#9a92c9]">DRAWS</div>
              <div className="text-xl font-black text-slate-300">{stats.d}</div>
            </div>
            <div className="rounded-xl bg-[#15113a] border border-[#b48cff]/[.12] py-2 text-center">
              <div className="text-[7px] font-extrabold tracking-[.12em] text-[#9a92c9]">LOSSES</div>
              <div className="text-xl font-black text-red-400">{stats.l}</div>
            </div>
            <div className="rounded-xl bg-[#15113a] border border-[#b48cff]/[.12] py-2 text-center">
              <div className="text-[7px] font-extrabold tracking-[.12em] text-[#9a92c9]">SEASON AVG</div>
              <div className="text-xl font-black bg-gradient-to-r from-[#ff4fd8] to-[#6ee7ff] bg-clip-text text-transparent">
                {stats.results > 0 ? stats.avg.toFixed(2) : '—'}
              </div>
              <div className="text-[7px] text-[#9a92c9]">goals / player</div>
            </div>
          </div>
          {stats.tot > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden mt-2.5 bg-[#0c0724]">
              <div className="bg-green-400" style={{ width: `${(stats.w / stats.tot) * 100}%` }} />
              <div className="bg-slate-300" style={{ width: `${(stats.d / stats.tot) * 100}%` }} />
              <div className="bg-red-400" style={{ width: `${(stats.l / stats.tot) * 100}%` }} />
            </div>
          )}
          <div className="flex justify-between text-[9px] font-bold text-[#9a92c9] mt-1.5">
            <span>Win rate {stats.winRate}%</span>
            <span>{stats.goals} goals · {stats.results} results</span>
          </div>
        </div>
      )}

      {filteredTournaments.length === 0 ? (
        <div className={`text-center py-16 rounded-3xl bg-[#1a1547] ${CARD}`}>
          <Trophy className="w-12 h-12 mx-auto mb-4 text-[#9a92c9]" />
          <h2 className="text-lg font-black tracking-wide">NO HISTORY YET</h2>
          <p className="text-sm text-[#9a92c9] mt-2">
            {activeSeason === 'all' ? 'Finished LVLs will show up here.' : `No finished LVLs in ${seasonLabel(activeSeason)} yet.`}
          </p>
        </div>
      ) : (
        filteredTournaments.map((t) => {
          const isOpen = expandedId === t.id;
          const resultColor =
            t.result === 'win' ? 'text-green-400' : t.result === 'loss' ? 'text-red-400' : 'text-slate-300';
          const resultLabel =
            t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : t.result === 'draw' ? 'DRAW' : '';
          const scored = t.players.filter((p) => p.score !== null);
          const mvp = scored.length > 0 ? scored.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a)) : null;
          const accentBar =
            t.result === 'win' ? 'bg-green-400' : t.result === 'loss' ? 'bg-red-400' : 'bg-[#9a92c9]';

          return (
            <div
              key={t.id}
              className={`relative rounded-xl bg-[#1a1547] overflow-hidden ${CARD}`}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBar}`} />
              <div
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                className="w-full pl-3.5 pr-2.5 py-2 text-left cursor-pointer hover:bg-[#241d5e]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black text-[#ff8ae6]">LVL {t.lvl}</span>
                      {resultLabel && (
                        <span className={`text-[7px] font-extrabold tracking-widest ${resultColor}`}>
                          {resultLabel}
                        </span>
                      )}
                      <span className="text-[7px] text-[#9a92c9]">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[11px] font-black mt-0.5 break-words">{t.opponent}</div>
                    {mvp && (
                      <div className="flex items-center gap-1 mt-1">
                        <Crown className="w-2 h-2 text-yellow-400 flex-shrink-0" strokeWidth={2.5} />
                        <span className="text-[7px] font-bold text-yellow-400 truncate">
                          MVP: {mvp.player?.fc_name || mvp.fc_name || 'Unknown'} ({mvp.score})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                        disabled={deletingId === t.id}
                        className="w-5 h-5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-2.5 h-2.5" />
                        )}
                      </button>
                    )}
                    <ChevronDown
                      className={`w-3 h-3 text-[#9a92c9] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#b48cff]/[.12]">
                  {scored.length > 0 ? (
                    <span className="text-[8px] text-[#9a92c9] font-bold">avg {(t.our_score / scored.length).toFixed(2)}</span>
                  ) : (
                    <span />
                  )}
                  <span className={`text-sm font-black tabular-nums ${resultColor}`}>
                    {t.our_score} : {t.opponent_score}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-[#b48cff]/[.12] p-1.5 space-y-1">
                  {t.players.length === 0 ? (
                    <div className="text-[#9a92c9] text-[9px] py-2 text-center">No player data.</div>
                  ) : (
                    [...t.players]
                      .sort((a, b) => (b.score || 0) - (a.score || 0))
                      .map((p) => {
                        const isMvp = mvp && p.id === mvp.id;
                        return (
                          <div
                            key={p.id}
                            className={`flex justify-between items-center px-2 py-1 rounded-md border ${
                              isMvp
                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-[#15113a] border-[#b48cff]/[.12]'
                            }`}
                          >
                            <span className="flex items-center gap-1 text-[9px] font-bold truncate">
                              {isMvp && <Crown className="w-2 h-2 text-yellow-400 flex-shrink-0" strokeWidth={2.5} />}
                              {p.player?.fc_name || p.fc_name || 'Unknown'}
                            </span>
                            <span className={`text-[9px] font-black flex-shrink-0 ${isMvp ? 'text-yellow-400' : 'text-[#ff8ae6]'}`}>
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

      <div className="text-center text-[9px] text-[#9a92c9]/70 tracking-[.2em] uppercase pt-2">
        FC MOBILE • LVL SYSTEM
      </div>

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => !deletingId && setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[#b48cff]/[.18] bg-gradient-to-b from-[#1b1450] to-[#0c0724] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-black tracking-wide">DELETE RESULT</h2>
            </div>
            <p className="text-xs text-[#9a92c9] mt-4 leading-relaxed">
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
