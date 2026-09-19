import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type Player, type Tournament, type TournamentPlayer, type RankingRow } from '@/lib/supabase';
import { Trophy, Search, X, Loader2, Target, Award } from 'lucide-react';
import PlayerSelect from '@/components/PlayerSelect';

const SEASONS = [{ id: 'season-21', name: 'Season 21' }];

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tpRows, setTpRows] = useState<TournamentPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [season, setSeason] = useState('season-21');

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

  const latestFinishedId = useMemo(() => {
    const finished = tournaments
      .filter((t) => t.status === 'finished')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return finished[0]?.id || null;
  }, [tournaments]);

  const previousRanking = useMemo(() => {
    if (!latestFinishedId) return [] as { id: string; name: string; games: number; average: number; total: number; maximum: number }[];
    const tournamentMap = new Map<string, Tournament>();
    tournaments.forEach((t) => tournamentMap.set(t.id, t));

    const validResults = tpRows.filter((r) => {
      if (!r.tournament_id || !r.player_id || r.score === null) return false;
      if (r.tournament_id === latestFinishedId) return false;
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
        return { id: player.id, name: player.fc_name || player.player_id, games, total, average, maximum };
      })
      .sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        if (b.games !== a.games) return b.games - a.games;
        if (b.total !== a.total) return b.total - a.total;
        if (b.maximum !== a.maximum) return b.maximum - a.maximum;
        return a.name.localeCompare(b.name);
      });
  }, [players, tournaments, tpRows, latestFinishedId]);

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
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-3 py-4 space-y-2.5 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-gradient-to-r from-[#0b1832] to-[#081124] shadow-xl shadow-black/30 px-3.5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4d7cff] to-[#27d7ff] flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
            <Trophy className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-black text-base tracking-wide truncate">SEASON 21</div>
            <div className="text-[8px] text-amber-400 tracking-widest font-bold">ANNIVERSARY</div>
          </div>
        </div>
        <div className="w-32 sm:w-40 flex-shrink-0">
          <PlayerSelect value={season} onChange={setSeason} options={SEASONS} />
        </div>
      </div>

      {/* Ranking Table */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0b1730] to-[#081327] shadow-xl shadow-black/30 overflow-hidden">
        <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-white/[.06]">
          <div>
            <div className="text-xs sm:text-sm font-black">PLAYER RANKING</div>
            <div className="text-[8px] text-slate-400">Active & finished LVLs</div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="px-2.5 py-1.5 rounded-lg border border-white/[.08] bg-[#08152b] text-white text-xs outline-none focus:border-cyan-500/50 w-28 sm:w-40"
          />
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse table-fixed text-[10px] sm:text-xs">
            <thead className="bg-[#08152b]">
              <tr>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[7%]">#</th>
                <th className="px-1.5 py-2 text-left text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[28%]">Player</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[8%]">GP</th>
                <th className="px-1.5 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[12%]">Avg</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[8%]">Max</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[8%]">Min</th>
                <th className="px-1 py-2 text-center text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-wider font-bold w-[30%]">Last 5</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    No players found.
                  </td>
                </tr>
              ) : (
                filtered.map((player) => {
                  const realRank = ranking.indexOf(player) + 1;
                  const rankColor =
                    realRank === 1
                      ? 'text-yellow-400 font-black'
                      : realRank === 2
                      ? 'text-slate-300 font-black'
                      : realRank === 3
                      ? 'text-orange-400 font-black'
                      : 'text-slate-400 font-bold';

                  return (
                    <tr
                      key={player.id}
                      onClick={() => setProfileId(player.id)}
                      className="border-b border-white/[.04] hover:bg-cyan-500/5 cursor-pointer transition-colors"
                    >
                      <td className={`px-1 py-1.5 text-center whitespace-nowrap ${rankColor}`}>{realRank}</td>
                      <td className="px-1.5 py-1.5 text-left">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="font-black truncate min-w-0" title={player.name}>
                            {player.name}
                          </div>
                          {(() => {
                            if (player.games === 0) return null;
                            const prevEntry = previousRanking.find((p) => p.id === player.id);
                            if (!prevEntry || prevEntry.games === 0) {
                              return <span className="text-[6.5px] font-black text-blue-400 flex-shrink-0">NEW</span>;
                            }
                            const prevRank = previousRanking.indexOf(prevEntry) + 1;
                            const delta = prevRank - realRank;
                            if (delta === 0) return null;
                            return delta > 0 ? (
                              <span className="text-[6.5px] font-black text-green-400 flex-shrink-0">▲{delta}</span>
                            ) : (
                              <span className="text-[6.5px] font-black text-red-400 flex-shrink-0">▼{Math.abs(delta)}</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-center font-bold whitespace-nowrap">{player.games}</td>
                      <td className="px-1.5 py-1.5 text-center font-black text-cyan-400 whitespace-nowrap">
                        {player.games ? player.average.toFixed(2) : '—'}
                      </td>
                      <td className="px-1 py-1.5 text-center font-black text-slate-200 whitespace-nowrap">
                        {player.games ? player.maximum : '—'}
                      </td>
                      <td className="px-1 py-1.5 text-center font-black text-slate-200 whitespace-nowrap">
                        {player.games ? player.minimum : '—'}
                      </td>
                      <td className="px-1 py-1.5">
                        <div className="flex justify-center gap-1 flex-nowrap overflow-hidden">
                          {player.lastFive.length > 0 ? (
                            player.lastFive.slice(0, 5).map((item, i) => (
                              <div
                                key={i}
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[6px] font-black flex-shrink-0 ${
                                  item.score > 34
                                    ? 'bg-green-500/25 border-green-500/50 text-green-300'
                                    : 'bg-red-500/25 border-red-500/50 text-red-300'
                                }`}
                              >
                                {item.score}
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-600">—</span>
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

      <div className="text-center text-[7.5px] text-slate-600 tracking-wide pt-0.5">
        FC MOBILE LVL SYSTEM
      </div>

      {/* Profile Modal */}
      {profilePlayer && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 z-50"
          onClick={() => setProfileId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[.08] bg-gradient-to-b from-[#0b1832] to-[#071225] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4.5 py-3.5 border-b border-white/[.06]">
              <div className="text-base font-black">{profilePlayer.name}</div>
              <button
                onClick={() => setProfileId(null)}
                className="w-8 h-8 rounded-lg border border-white/[.08] bg-[#0d1b35] text-white flex items-center justify-center hover:border-red-500/30 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4.5">
              {/* Stats Grid */}
              <div className="grid grid-cols-5 gap-1.5 mb-3.5">
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl py-2 px-1 text-center min-w-0">
                  <div className="text-[6.5px] text-slate-400 uppercase tracking-wide font-bold">Rank</div>
                  <div className="text-[11px] font-black mt-0.5">#{profileRank}</div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl py-2 px-1 text-center min-w-0">
                  <div className="text-[6.5px] text-slate-400 uppercase tracking-wide font-bold">Games</div>
                  <div className="text-[11px] font-black mt-0.5">{profilePlayer.games}</div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl py-2 px-1 text-center min-w-0">
                  <div className="text-[6.5px] text-slate-400 uppercase tracking-wide font-bold">Average</div>
                  <div className="text-[11px] font-black mt-0.5 text-cyan-400 whitespace-nowrap">
                    {profilePlayer.games ? profilePlayer.average.toFixed(2) : '—'}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl py-2 px-1 text-center min-w-0">
                  <div className="text-[6.5px] text-slate-400 uppercase tracking-wide font-bold">Best</div>
                  <div className="text-[11px] font-black mt-0.5 text-slate-200">
                    {profilePlayer.games ? profilePlayer.maximum : '—'}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl py-2 px-1 text-center min-w-0">
                  <div className="text-[6.5px] text-slate-400 uppercase tracking-wide font-bold">Min</div>
                  <div className="text-[11px] font-black mt-0.5 text-slate-200">
                    {profilePlayer.games ? profilePlayer.minimum : '—'}
                  </div>
                </div>
              </div>

              {/* Score Trend Chart */}
              {(() => {
                const trendData = profilePlayer.allResults
                  .filter((r) => r.score !== null)
                  .slice(0, 10)
                  .reverse()
                  .map((r) => r.score as number);
                if (trendData.length < 2) return null;
                const width = 300;
                const height = 64;
                const pad = 8;
                const max = Math.max(...trendData);
                const min = Math.min(...trendData);
                const range = max - min || 1;
                const stepX = (width - pad * 2) / (trendData.length - 1);
                const points = trendData.map((v, i) => ({
                  x: pad + i * stepX,
                  y: pad + (height - pad * 2) * (1 - (v - min) / range),
                  v,
                }));
                const trendUp = trendData[trendData.length - 1] >= trendData[0];
                const segments = points.slice(1).map((p, i) => {
                  const prev = points[i];
                  const color = p.v > prev.v ? '#4ade80' : p.v < prev.v ? '#f87171' : '#facc15';
                  return { x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, color };
                });
                return (
                  <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-3 mb-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[8.5px] font-black tracking-wide uppercase text-slate-400">Score Trend</div>
                      <div className={`text-[9.5px] font-black ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
                        {trendUp ? '▲' : '▼'} {trendData[0]} → {trendData[trendData.length - 1]}
                      </div>
                    </div>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14">
                      {segments.map((s, i) => (
                        <line
                          key={i}
                          x1={s.x1}
                          y1={s.y1}
                          x2={s.x2}
                          y2={s.y2}
                          stroke={s.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      ))}
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={p.v > 34 ? '#4ade80' : '#f87171'} />
                      ))}
                    </svg>
                  </div>
                );
              })()}

              {/* Last Results */}
              <div className="text-[8.5px] font-black tracking-wide uppercase text-slate-400 mb-1.5">
                Last Results
              </div>
              <div className="space-y-1.5 mb-3.5">
                {profilePlayer.allResults.length === 0 ? (
                  <div className="text-slate-400 text-xs py-2 text-center">No results submitted yet.</div>
                ) : (
                  profilePlayer.allResults.slice(0, 10).map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-[#08152b] border border-white/[.06] rounded-lg px-2.5 py-1.5"
                    >
                      <div className="text-[10px] font-black truncate min-w-0">
                        LVL {r.lvl} <span className="text-slate-400 font-bold">vs {r.opponent}</span>
                      </div>
                      <div className="text-xs font-black text-cyan-400 flex-shrink-0 ml-2">
                        {r.score === null ? '—' : r.score}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Achievements */}
              <div className="text-[8.5px] font-black tracking-wide uppercase text-slate-400 mb-1.5">
                Achievements
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2.5">
                  <div className="text-[9px] font-black flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-green-400" />
                    40+ GOALS CLUB
                  </div>
                  <div className="text-[8px] text-slate-400 mt-1">
                    {profilePlayer.total >= 40
                      ? 'Unlocked — 40+ goals'
                      : `${profilePlayer.total} total goals`}
                  </div>
                </div>
                <div className="bg-[#08152b] border border-white/[.06] rounded-xl p-2.5">
                  <div className="text-[9px] font-black flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-yellow-400" />
                    BEST PERFORMANCE
                  </div>
                  <div className="text-[8px] text-slate-400 mt-1">
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
