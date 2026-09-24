import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import { Zap, Shield, Trophy, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import PlayerSelect from '@/components/PlayerSelect';

type LiveData = {
  tournament: Tournament | null;
  players: (TournamentPlayer & { player: Player | null })[];
};

export default function SubmitPage() {
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<LiveData | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [goals, setGoals] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');
  const [countdownClass, setCountdownClass] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: tournament, error: tError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tError) throw tError;

      if (!tournament) {
        setLive({ tournament: null, players: [] });
        setLoading(false);
        return;
      }

      const { data: tpRows, error: tpError } = await supabase
        .from('tournament_players')
        .select('*, player:players(*)')
        .eq('tournament_id', tournament.id);

      if (tpError) throw tpError;

      setLive({
        tournament: tournament as Tournament,
        players: (tpRows || []) as (TournamentPlayer & { player: Player | null })[],
      });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!live?.tournament?.end_time) {
      setCountdown('00:00:00');
      setCountdownClass('');
      return;
    }
    const update = () => {
      const end = new Date(live.tournament!.end_time!).getTime();
      const remaining = end - Date.now();
      if (remaining <= 0) {
        setCountdown('00:00:00');
        setCountdownClass('text-red-400');
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
      if (remaining < 15 * 60 * 1000) setCountdownClass('text-red-400');
      else if (remaining < 60 * 60 * 1000) setCountdownClass('text-yellow-400');
      else setCountdownClass('');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [live?.tournament?.end_time]);

  const handleSubmit = async () => {
    if (!live?.tournament) return;
    if (!selectedPlayerId) {
      setStatus({ type: 'error', msg: 'Please select your name.' });
      return;
    }
    const numericGoals = Number(goals);
    if (goals === '' || !Number.isInteger(numericGoals) || numericGoals < 0 || numericGoals > 99) {
      setStatus({ type: 'error', msg: 'Please enter a valid goal number (0-99).' });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const tpRow = live.players.find((p) => p.player_id === selectedPlayerId);
      if (!tpRow) {
        setStatus({ type: 'error', msg: 'Player not found in this tournament.' });
        setSubmitting(false);
        return;
      }
      if (tpRow.status === 'submitted') {
        setStatus({ type: 'error', msg: 'You have already submitted your result.' });
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          score: numericGoals,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', tpRow.id);

      if (updateError) throw updateError;

      const submittedPlayers = live.players.filter((p) => p.status === 'submitted');
      const newOurScore =
        submittedPlayers.reduce((sum, p) => sum + (p.score || 0), 0) + numericGoals;

      await supabase
        .from('tournaments')
        .update({ our_score: newOurScore })
        .eq('id', live.tournament.id);

      const playerName = tpRow.player?.fc_name || tpRow.fc_name || 'Player';
      setStatus({ type: 'success', msg: `Result submitted — ${playerName}: ${numericGoals} goals` });
      setSubmitting(false);
      setGoals('');
      setSelectedPlayerId('');
      loadData();
    } catch {
      setStatus({ type: 'error', msg: 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-blue-400" />
        <span className="text-sm tracking-wide">Loading current LVL...</span>
      </div>
    );
  }

  if (!live?.tournament) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center py-16 rounded-3xl border border-white/[.06] bg-gradient-to-b from-white/[.03] to-transparent">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <h2 className="text-xl font-black tracking-wide">NO ACTIVE LVL</h2>
          <p className="text-sm text-slate-400 mt-2">
            There is currently no active LVL tournament.
            <br />
            Please check again later.
          </p>
        </div>
      </div>
    );
  }

  const t = live.tournament;
  const submitted = live.players.filter((p) => p.status === 'submitted');
  const total = live.players.length;
  const submittedCount = submitted.length;
  const ourScore = submitted.reduce((sum, p) => sum + (p.score || 0), 0);
  const progressPct = total > 0 ? (submittedCount / total) * 100 : 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      {/* Match Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-b from-white/[.04] to-white/[.01] shadow-2xl shadow-black/40 p-6">
        <div
          className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-56 h-56 rounded-full opacity-25 blur-[60px]"
          style={{ background: 'rgba(36,135,255,.4)' }}
        />

        <div className="relative">
          {/* Live badge */}
          <div className="flex justify-center mb-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-extrabold tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(32,227,154,.8)] animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-4">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-[#172a4a] to-[#0b1528] border border-white/[.08] flex items-center justify-center shadow-inner">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-white">Your Team</div>
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <span className="text-4xl font-black tracking-tighter">{ourScore}</span>
              <span className="text-2xl text-slate-600">:</span>
              <span className="text-4xl font-black tracking-tighter text-slate-400">
                {t.opponent_score || 0}
              </span>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-[#172a4a] to-[#0b1528] border border-white/[.08] flex items-center justify-center shadow-inner">
                <Shield className="w-6 h-6 text-slate-300" />
              </div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-300 break-words">
                {t.opponent || 'OPPONENT'}
              </div>
            </div>
          </div>

          {/* Current Average */}
          {submittedCount > 0 && (
            <div className="text-center -mt-1">
              <span className="text-[11px] text-slate-400 font-bold">
                AVG: <span className="text-cyan-400 font-black">{(ourScore / submittedCount).toFixed(2)}</span>
                <span className="text-slate-500"> ({submittedCount} submitted)</span>
              </span>
            </div>
          )}

          {/* Countdown */}
          <div className="mt-6 p-3.5 rounded-2xl bg-white/[.025] border border-white/[.08] text-center">
            <div className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">
              Time Remaining
            </div>
            <div className={`mt-1 text-xl sm:text-2xl font-black tracking-[2px] sm:tracking-[3px] tabular-nums ${countdownClass}`}>
              {countdown}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-slate-400 font-bold tracking-wide">
                PLAYER SUBMISSIONS
              </span>
              <span className="text-xs font-black">
                {submittedCount} / {total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#17233a] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2487ff] to-[#00c6ff] shadow-[0_0_14px_rgba(36,135,255,.5)] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit Form */}
      <div className="rounded-3xl border border-white/[.08] bg-[#0c172b] shadow-xl shadow-black/25 p-5">
        <h3 className="text-sm font-black tracking-wide uppercase mb-4 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-blue-400" />
          Submit Your Result
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
              Select Your Name
            </label>
            <PlayerSelect
              value={selectedPlayerId}
              onChange={setSelectedPlayerId}
              options={[...live.players]
                .sort((a, b) =>
                  (a.fc_name || a.player?.fc_name || '').localeCompare(b.fc_name || b.player?.fc_name || '')
                )
                .map((p) => {
                  const name = p.player?.fc_name || p.fc_name || 'Unknown';
                  const isSubmitted = p.status === 'submitted';
                  return {
                    id: p.player_id,
                    name: isSubmitted ? `${name} ✓` : name,
                    disabled: isSubmitted,
                  };
                })}
            />
          </div>

          <div>
            <label className="block mb-2 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
              Your Goals
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="0"
              className="w-full h-14 px-4 rounded-2xl border border-white/[.08] bg-[#081327] text-white text-2xl font-black text-center outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#2487ff] to-[#00c6ff] text-white text-sm font-black tracking-widest shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'SENDING...' : '⚡ SUBMIT RESULT'}
          </button>

          {status && (
            <div
              className={`flex items-center gap-2 p-3.5 rounded-xl text-xs font-bold ${
                status.type === 'success'
                  ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {status.msg}
            </div>
          )}
        </div>
      </div>

      {/* Player Status */}
      <div className="rounded-3xl border border-white/[.08] bg-[#0c172b] shadow-xl shadow-black/25 p-5">
        <h3 className="text-sm font-black tracking-wide uppercase mb-4 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-blue-400" />
          Player Status
        </h3>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {[...live.players]
            .sort((a, b) => {
              const aDone = a.status === 'submitted' ? 1 : 0;
              const bDone = b.status === 'submitted' ? 1 : 0;
              if (aDone !== bDone) return aDone - bDone;
              return (a.player?.fc_name || a.fc_name || '').localeCompare(b.player?.fc_name || b.fc_name || '');
            })
            .map((p) => {
              const name = p.player?.fc_name || p.fc_name || 'Unknown';
              const done = p.status === 'submitted';
              return (
                <div
                  key={p.id}
                  className={`flex justify-between items-center px-3 py-2.5 rounded-lg border ${
                    done ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/15 bg-[#071126]'
                  }`}
                >
                  <span className="text-xs font-bold">{name}</span>
                  {done ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {p.score} goal{p.score === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-yellow-400">WAITING</span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[.08] bg-[#0c172b] p-4 text-center">
          <Trophy className="w-5 h-5 mx-auto mb-2 text-yellow-400" />
          <div className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">LVL</div>
          <div className="text-base font-black mt-1">{t.lvl}</div>
        </div>
        <div className="rounded-2xl border border-white/[.08] bg-[#0c172b] p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-2 text-blue-400" />
          <div className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">Players</div>
          <div className="text-base font-black mt-1">{total}</div>
        </div>
      </div>

      <div className="text-center text-[9px] text-slate-600 tracking-widest uppercase pt-2">
        FC MOBILE • LVL SYSTEM
      </div>
    </div>
  );
}
