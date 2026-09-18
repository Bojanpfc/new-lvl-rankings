import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type Player, type Tournament, type TournamentPlayer, type RankingRow } from '@/lib/supabase';
import { Trophy, Search, X, Loader2, Target, Award } from 'lucide-react';

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tpRows, setTpRows] = useState<TournamentPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [pRes, tRes, tpRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('tournaments').select('*').in('status', ['active', 'finished']),
        supabase.from('tournament_players').select('*'),
      ]);

      if (pRes.error) throw pRes.error;
      if (tRes.error) throw tRes.error;
      if (tpRes.error) throw tpRes.error;

      setPlayers((pRes.data || []) as Player[]);
      setTournaments((tRes.data || []) as Tournament[]);
      setTpRows((tpRes.data || []) as TournamentPlayer[]);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ranking.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const ranking: RankingRow[] = useMemo(() => {
    const tournamentMap = new Map<string, Tournament>();
    tournaments.forEach((t) => tournamentMap.set(t.id, t));

    const validResults = tpRows.filter((r) => {
      if (!r.tournament_id || !r.player_id || r.score === null) return false;
      return tournamentMap.has(r.tournament_id);
    });

    const resultsByPlayer = new Map<string, TournamentPlayer[]>();
    validResults.forEach((r) => {
      if (!resultsByPlayer.has(r.player_id)) resultsByPlayer.set(r.player_id, []);
      resultsByPlayer.get(r.player_id)!.push(r);
    });

    return players
      .map((player) => {
        const results = resultsByPlayer.get(player.id) || [];
        const scores = results.map((r) => r.score || 0);
        const games = scores.length;
        const total = scores.reduce((s, v) => s + v, 0);
        const average = games > 0 ? total / games : 0;
        const maximum = games > 0 ? Math.max(...scores) : 0;
        const minimum = games > 0 ? Math.min(...scores) : 0;

        const sortedResults = [...results].sort((a, b) => {
          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          return bTime - aTime;
        });

        const lastFive = sortedResults.slice(0, 5).map((r) => {
          const t = tournamentMap.get(r.tournament_id);
          return {
            score: r.score || 0,
            lvl: t?.lvl || 0,
            opponent: t?.opponent || '',
          };
        });

        return {
          id: player.id,
          name: player.fc_name || player.player_id,
          games,
          total,
          average,
          maximum,
          minimum,
          lastFive,
          allResults: sortedResults.map((r) => {
            const t = tournamentMap.get(r.tournament_id);
            return {
              score: r.score,
              lvl: t?.lvl || 0,
              opponent: t?.opponent || '',
              status: r.status,
              submitted_at: r.submitted_at,
            };
          }),
        };
      })
      .sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        if (b.games !== a.games) return b.games - a.games;
        if (b.total !== a.total) return b.total - a.total;
        if (b.maximum !== a.maximum) return b.maximum - a.maximum;
        return a.name.localeCompare(b.name);
      });
  }, [players, tournaments, tpRows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ranking;
    const q = search.toLowerCase();
    return ranking.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [ranking, search]);

  const profilePlayer = profileId ? ranking.find((p) => p.id === profileId) : null;
  const profileRank = profilePlayer ? ranking.indexOf(profilePlayer) + 1 : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-blue-400" />
        <span className="text-sm tracking-wide">Loading ranking...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[.08] bg-gradient-to-r from-[#0b1832] to-[#081124] shadow-xl shadow-black/30 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4d7cff] to-[#27d7ff] flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-black text-lg tracking-wide">LVL RANKING</div>
            <div className="text-[9px] text-slate-400 tracking-widest">FC MOBILE • PERFORMANCE RANKING</div>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[.08] bg-[#0d1b35] text-xs font-bold hover:border-cyan-500/50 transition-all"
        >
          <Search className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Ranking Table */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0b1730] to-[#081327] shadow-xl shadow-black/30 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-white/[.06]">
          <div>
            <div className="text-sm font-black">PLAYER RANKING</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Active & finished LVLs</div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="px-3 py-2 rounded-lg border border-white/[.08] bg-[#08152b] text-white text-xs outline-none focus:border-cyan-500/50 w-32 sm:w-44"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-auto sm:table-fixed">
            <thead className="bg-[#08152b]">
              <tr>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[8%]">#</th>
                <th className="px-1.5 py-2 text-left text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[34%]">Player</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[9%]">GP</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[11%]">Avg</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[11%]">Max</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[11%]">Min</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[16%]">Last 5</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No players found.
                  </td>
                </tr>
              ) : (
                filtered.map((player) => {
                  const realRank = ranking.indexOf(player) + 1;
                  const rankColor =
                    realRank === 1
                      ? 'text-yellow-400 text-xs sm:text-sm'
                      : realRank === 2
                      ? 'text-slate-300 text-xs sm:text-sm'
                      : realRank === 3
                      ? 'text-orange-400 text-xs sm:text-sm'
                      : 'text-slate-400 text-xs';

                  return (
                    <tr
                      key={player.id}
                      onClick={() => setProfileId(player.id)}
                      className="border-b border-white/[.04] hover:bg-cyan-500/5 cursor-pointer transition-colors"
                    >
                      <td className={`px-1 py-2 text-center font-black ${rankColor}`}>{realRank}</td>
                      <td className="px-1.5 py-2 text-left">
                        <div className="text-[11px] sm:text-xs font-black truncate max-w-[100px] sm:max-w-none" title={player.name}>
                          {player.name}
                        </div>
                      </td>
                      <td className="px-1 py-2 text-center text-[11px] sm:text-xs font-bold">{player.games}</td>
                      <td className="px-1 py-2 text-center text-[11px] sm:text-xs font-black text-cyan-400">
                        {player.games ? player.average.toFixed(2) : '—'}
                      </td>
                      <td className="px-1 py-2 text-center text-[11px] sm:text-xs font-black text-green-400">
                        {player.games ? player.maximum : '—'}
                      </td>
                      <td className="px-1 py-2 text-center text-[11px] sm:text-xs font-black text-yellow-400">
                        {player.games ? player.minimum : '—'}
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex justify-center gap-0.5 flex-nowrap overflow-hidden">
                          {player.lastFive.length > 0 ? (
                            player.lastFive.slice(0, 5).map((item, i) => (
                              <div
                                key={i}
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded flex items-center justify-center border text-[7px] sm:text-[8px] font-black flex-shrink-0 ${
                                  item.score > 34
                                    ? 'bg-green-500/25 border-green-500/50 text-green-300'
                                    : 'bg-red-500/25 border-red-500/50 text-red-300'
                                }`}
                              >
                                {item.score}
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-[8px] text-slate-600 tracking-wide pt-1">
        FC MOBILE LVL SYSTEM
      </div>

      {/* Profile Modal */}
      {profilePlayer && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => setProfileId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[.08] bg-gradient-to-b from-[#0b1832] to-[#071225] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/[.06]">
              <div className="text-lg font-black">{profilePlayer.name}</div>
              <button
                onClick={() => setProfileId(null)}
                className="w-9 h-9 rounded-lg border border-white/[.08] bg-[#0d1b35] text-white flex items-center justify-center hover:border-red-500/30 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {/* Stats Grid */}
              <div className="grid grid-cols-5 gap-1.5 mb-5">
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2 text-center min-w-0">
                  <div className="text-[7px] text-slate-400 uppercase tracking-wide font-bold">Rank</div>
                  <div className="text-xs font-black mt-1">#{profileRank}</div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2 text-center min-w-0">
                  <div className="text-[7px] text-slate-400 uppercase tracking-wide font-bold">Games</div>
                  <div className="text-xs font-black mt-1">{profilePlayer.games}</div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2 text-center min-w-0">
                  <div className="text-[7px] text-slate-400 uppercase tracking-wide font-bold">Average</div>
                  <div className="text-xs font-black mt-1 text-cyan-400">
                    {profilePlayer.games ? profilePlayer.average.toFixed(2) : '—'}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2 text-center min-w-0">
                  <div className="text-[7px] text-slate-400 uppercase tracking-wide font-bold">Best</div>
                  <div className="text-xs font-black mt-1 text-green-400">
                    {profilePlayer.games ? profilePlayer.maximum : '—'}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2 text-center min-w-0">
                  <div className="text-[7px] text-slate-400 uppercase tracking-wide font-bold">Min</div>
                  <div className="text-xs font-black mt-1 text-yellow-400">
                    {profilePlayer.games ? profilePlayer.minimum : '—'}
                  </div>
                </div>
              </div>

              {/* Last Results */}
              <div className="text-[10px] font-black tracking-wide uppercase text-slate-400 mb-2">
                Last Results
              </div>
              <div className="space-y-1.5 mb-4">
                {profilePlayer.allResults.length === 0 ? (
                  <div className="text-slate-400 text-xs py-3 text-center">No results submitted yet.</div>
                ) : (
                  profilePlayer.allResults.slice(0, 10).map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-[#08152b] border border-white/[.06] rounded-lg px-3 py-2.5"
                    >
                      <div>
                        <div className="text-xs font-black">LVL {r.lvl}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">vs {r.opponent}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{r.status}</div>
                      </div>
                      <div className="text-lg font-black text-cyan-400">
                        {r.score === null ? '—' : r.score}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Achievements */}
              <div className="text-[10px] font-black tracking-wide uppercase text-slate-400 mb-2">
                Achievements
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-3">
                  <div className="text-[10px] font-black flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-green-400" />
                    40+ GOALS CLUB
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1.5">
                    {profilePlayer.total >= 40
                      ? 'Unlocked — 40+ goals'
                      : `${profilePlayer.total} total goals`}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-3">
                  <div className="text-[10px] font-black flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-yellow-400" />
                    BEST PERFORMANCE
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1.5">
                    {profilePlayer.games
                      ? `Best score: ${profilePlayer.maximum} goals`
                      : 'No results yet'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
