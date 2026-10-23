import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import { Zap, Trophy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
  const [countdownClass, setCountdownClass] = useState('text-[#d4af37]');

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
      setCountdownClass('text-[#d4af37]');
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
      else setCountdownClass('text-[#d4af37]');
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
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-[#d4af37]" />
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
    <div className="max-w-xl mx-auto px-3 py-4 space-y-3">
      {/* Match + status card */}
      <div className="rounded-2xl border border-[#d4af37]/[.14] bg-gradient-to-b from-[#0f1c35] to-[#081124] shadow-xl shadow-black/30 overflow-hidden">
        {/* Top bar: LIVE + timer */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,.8)] animate-pulse" />
            LIVE
          </span>
          <span className={`text-[11px] font-bold tabular-nums ${countdownClass}`}>⏱ {countdown}</span>
        </div>

        {/* Score line */}
        <div className="flex items-baseline justify-center gap-4 px-4 pb-1">
          <div className="text-center flex-1">
            <div className="text-[9px] font-black tracking-wide text-slate-400 uppercase mb-0.5">GOATS</div>
            <div className="text-[34px] leading-none font-black tracking-tighter text-white">{ourScore}</div>
          </div>
          <span className="text-xl text-[#3a4a66] self-center">:</span>
          <div className="text-center flex-1">
            <div className="text-[9px] font-black tracking-wide text-slate-400 uppercase mb-0.5 truncate">
              {t.opponent || 'OPPONENT'}
            </div>
            <div className="text-[34px] leading-none font-black tracking-tighter text-slate-400">
              {t.opponent_score || 0}
            </div>
          </div>
        </div>

        {/* Avg */}
        {submittedCount > 0 && (
          <div className="text-center text-[10px] text-slate-400 font-bold pb-2.5">
            AVG <span className="text-[#f5d576] font-black">{(ourScore / submittedCount).toFixed(2)}</span>{' '}
            <span className="text-slate-500">({submittedCount} submitted)</span>
          </div>
        )}

        {/* Progress */}
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
            <span>PLAYER SUBMISSIONS</span>
            <span>{submittedCount} / {total}</span>
          </div>
          <div className="h-[5px] rounded-full bg-[#0a1322] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d576] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Player status pills */}
        <div className="px-4 pb-4">
          <div className="text-[9px] font-black tracking-widest text-slate-400 uppercase mb-1.5">Player Status</div>
          <div className="flex flex-wrap gap-1.5">
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
                  <span
                    key={p.id}
                    className={`text-[9px] font-bold px-2 py-1 rounded-full border ${
                      done
                        ? 'bg-[#d4af37]/10 border-[#d4af37]/35 text-[#f5d576]'
                        : 'bg-white/[.02] border-white/[.08] text-slate-500'
                    }`}
                  >
                    {name}
                    {done && <span className="ml-1">✓{p.score}</span>}
                  </span>
                );
              })}
          </div>
        </div>
      </div>

      {/* Submit form */}
      <div className="rounded-2xl border border-[#d4af37]/[.14] bg-[#0c172b] shadow-xl shadow-black/25 p-4">
        <h3 className="text-[11px] font-black tracking-widest uppercase mb-3 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#d4af37]" />
          Submit Your Result
        </h3>

        <div className="flex gap-2">
          <div className="flex-[1.6]">
            <PlayerSelect
              value={selectedPlayerId}
              onChange={setSelectedPlayerId}
              options={[...live.players]
                .sort((a, b) =>
                  (a.player?.fc_name || a.fc_name || '').localeCompare(b.player?.fc_name || b.fc_name || '')
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
          <input
            type="number"
            min={0}
            max={99}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="0"
            className="flex-[0.6] h-[42px] rounded-xl border border-[#d4af37]/20 bg-[#050d1d] text-white text-lg font-black text-center outline-none focus:border-[#d4af37]/60 transition-all"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-2.5 h-11 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f5d576] text-[#1a1408] text-xs font-black tracking-widest shadow-lg shadow-[#d4af37]/20 hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? 'SENDING...' : '⚡ SUBMIT RESULT'}
        </button>

        {status && (
          <div
            className={`flex items-center gap-2 mt-2.5 p-3 rounded-xl text-xs font-bold ${
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

      <div className="text-center text-[9px] text-slate-600 tracking-widest uppercase pt-1">
        FC MOBILE • LVL SYSTEM
      </div>
    </div>
  );
}
