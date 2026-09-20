import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import {
  Shield, RefreshCw, Trophy, Users, Clock, Lock, Play, Square, Trash2,
  CheckCircle2, Loader2, AlertCircle, ChevronRight, UserPlus, Pencil, X, Bell, Check, KeyRound,
} from 'lucide-react';

const ADMIN_SESSION_KEY = 'fc-mobile-admin-unlocked';

function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const correctPin = import.meta.env.VITE_ADMIN_PIN as string | undefined;
    if (!correctPin) {
      setError('Admin PIN not configured. Add VITE_ADMIN_PIN to .env.');
      return;
    }
    if (pin === correctPin) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      onUnlock();
    } else {
      setError('Wrong PIN.');
      setPin('');
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="rounded-3xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-green-400" />
        </div>
        <h2 className="text-base font-black tracking-wide">ADMIN ACCESS</h2>
        <p className="text-xs text-slate-400 mt-1.5 mb-4">Enter the admin PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="PIN"
          autoFocus
          className="w-full h-12 px-4 rounded-xl border border-white/[.08] bg-[#050d1d] text-white text-center text-lg font-black tracking-[6px] outline-none focus:border-green-500/50 transition-all"
        />
        {error && <p className="text-[11px] text-red-400 mt-2 font-bold">{error}</p>}
        <button
          onClick={handleSubmit}
          className="w-full mt-4 py-3 rounded-xl bg-green-500 text-[#03120b] text-sm font-black hover:-translate-y-0.5 active:scale-[.98] transition-all"
        >
          UNLOCK
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true');
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tpRows, setTpRows] = useState<(TournamentPlayer & { player: Player | null })[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [countdown, setCountdown] = useState('—');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create form
  const [newLvl, setNewLvl] = useState('');
  const [newOpponent, setNewOpponent] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishScoreInput, setFinishScoreInput] = useState('');
  const [finishModalError, setFinishModalError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Player management
  const [showPlayerMgr, setShowPlayerMgr] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerDiscordId, setNewPlayerDiscordId] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editDiscordId, setEditDiscordId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [playerAction, setPlayerAction] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  // Score editing
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: activeT, error: tErr } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tErr) throw tErr;

      if (activeT) {
        setTournament(activeT as Tournament);
        const { data: tpData, error: tpErr } = await supabase
          .from('tournament_players')
          .select('*, player:players(*)')
          .eq('tournament_id', activeT.id);
        if (tpErr) throw tpErr;
        setTpRows((tpData || []) as (TournamentPlayer & { player: Player | null })[]);
      } else {
        setTournament(null);
        setTpRows([]);
      }

      const { data: playersData, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('active', true)
        .order('fc_name', { ascending: true });

      if (pErr) throw pErr;
      setAllPlayers((playersData || []) as Player[]);
      setLoading(false);
    } catch (err) {
      console.error('Admin loadData error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!tournament?.end_time) {
      setCountdown('—');
      return;
    }
    const update = () => {
      const end = new Date(tournament!.end_time!).getTime();
      const diff = end - Date.now();
      if (diff <= 0) {
        setCountdown('EXPIRED');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [tournament?.end_time]);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === allPlayers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allPlayers.map((p) => p.id)));
    }
  };

  const handleStart = async () => {
    if (tournament) {
      setStatusMsg({ type: 'error', msg: 'A LVL is already active. Finish it first.' });
      return;
    }
    const lvl = Number(newLvl);
    if (!newLvl || isNaN(lvl)) {
      setStatusMsg({ type: 'error', msg: 'Please enter a valid LVL number.' });
      return;
    }
    if (!newOpponent.trim()) {
      setStatusMsg({ type: 'error', msg: 'Please enter the opponent name.' });
      return;
    }
    if (selectedIds.size === 0) {
      setStatusMsg({ type: 'error', msg: 'Please select at least one player.' });
      return;
    }

    setStarting(true);
    try {
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: newT, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          lvl,
          opponent: newOpponent.trim(),
          start_time: new Date().toISOString(),
          end_time: endTime,
          status: 'active',
          our_score: 0,
          opponent_score: 0,
        })
        .select()
        .single();

      if (tErr) throw tErr;

      const tpInserts = Array.from(selectedIds).map((pid) => {
        const player = allPlayers.find((p) => p.id === pid);
        return {
          tournament_id: newT.id,
          player_id: pid,
          fc_name: player?.fc_name || '',
          status: 'pending',
        };
      });

      const { error: tpErr } = await supabase.from('tournament_players').insert(tpInserts);
      if (tpErr) throw tpErr;

      setStatusMsg({ type: 'success', msg: `LVL ${lvl} started with ${selectedIds.size} players.` });
      setNewLvl('');
      setNewOpponent('');
      setSelectedIds(new Set());
      setStarting(false);
      loadData();
    } catch (err) {
      console.error('Start LVL error:', err);
      setStatusMsg({ type: 'error', msg: 'Could not start LVL. Check console for details.' });
      setStarting(false);
    }
  };

  const handleFinish = async () => {
    if (!tournament) return;
    setFinishScoreInput('');
    setFinishModalError('');
    setShowFinishModal(true);
  };

  const confirmFinish = async () => {
    if (!tournament) return;
    const score = Number(finishScoreInput);
    if (finishScoreInput.trim() === '' || isNaN(score) || score < 0) {
      setFinishModalError('Please enter a valid number.');
      return;
    }

    setFinishing(true);
    try {
      const ourScore = tpRows
        .filter((p) => p.status === 'submitted')
        .reduce((sum, p) => sum + (p.score || 0), 0);

      let result = 'draw';
      if (ourScore > score) result = 'win';
      else if (ourScore < score) result = 'loss';

      const { error } = await supabase
        .from('tournaments')
        .update({
          status: 'finished',
          opponent_score: score,
          our_score: ourScore,
          result,
        })
        .eq('id', tournament.id);

      if (error) throw error;

      setStatusMsg({ type: 'success', msg: 'LVL finished successfully.' });
      setFinishing(false);
      setShowFinishModal(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not finish LVL.' });
      setFinishing(false);
    }
  };

  const handleDelete = async () => {
    if (!tournament) return;
    if (!confirm('DELETE this LVL? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure?')) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from('tournaments').delete().eq('id', tournament.id);
      if (error) throw error;
      setStatusMsg({ type: 'success', msg: 'Tournament deleted.' });
      setDeleting(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not delete tournament.' });
      setDeleting(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setStatusMsg({ type: 'error', msg: 'Please enter an FC Name.' });
      return;
    }
    setPlayerAction(true);
    try {
      const generatedId = `P-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const { error } = await supabase.from('players').insert({
        player_id: generatedId,
        fc_name: newPlayerName.trim(),
        discord_id: newPlayerDiscordId.trim(),
        active: true,
      });
      if (error) throw error;
      setStatusMsg({ type: 'success', msg: `Player "${newPlayerName.trim()}" added.` });
      setNewPlayerName('');
      setNewPlayerDiscordId('');
      setPlayerAction(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not add player.' });
      setPlayerAction(false);
    }
  };

  const handleEditScore = (row: TournamentPlayer & { player: Player | null }) => {
    setEditingScoreId(row.id);
    setEditScoreValue(String(row.score ?? 0));
  };

  const handleSaveScore = async (row: TournamentPlayer & { player: Player | null }) => {
    const newScore = Number(editScoreValue);
    if (editScoreValue === '' || !Number.isInteger(newScore) || newScore < 0 || newScore > 99) {
      setStatusMsg({ type: 'error', msg: 'Enter a valid goal number (0-99).' });
      return;
    }
    setSavingScore(true);
    try {
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({ score: newScore, edited_at: new Date().toISOString() })
        .eq('id', row.id);
      if (updateError) throw updateError;

      if (tournament) {
        const newOurScore = tpRows
          .filter((p) => p.status === 'submitted')
          .reduce((sum, p) => sum + (p.id === row.id ? newScore : p.score || 0), 0);
        await supabase.from('tournaments').update({ our_score: newOurScore }).eq('id', tournament.id);
      }

      setStatusMsg({ type: 'success', msg: `Updated ${row.player?.fc_name || row.fc_name}'s score to ${newScore}.` });
      setEditingScoreId(null);
      setSavingScore(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not update score.' });
      setSavingScore(false);
    }
  };

  const sendDiscordMessage = async (content: string) => {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL as string | undefined;
    if (!webhookUrl) {
      throw new Error('missing-webhook');
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('webhook-failed');
  };

  const handleAnnounceStart = async () => {
    if (!tournament) return;
    setAnnouncing(true);
    try {
      await sendDiscordMessage(
        `🚨 **New LVL Started!** LVL ${tournament.lvl} vs **${tournament.opponent}** — you have 24h to submit your result!`
      );
      setStatusMsg({ type: 'success', msg: 'Announcement sent to Discord.' });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'missing-webhook'
          ? 'Discord webhook not configured. Add VITE_DISCORD_WEBHOOK_URL to .env.'
          : 'Could not send announcement.';
      setStatusMsg({ type: 'error', msg });
    } finally {
      setAnnouncing(false);
    }
  };

  const handleBroadcastReminder = async () => {
    if (!tournament) return;
    setBroadcasting(true);
    try {
      const stillWaiting = tpRows.filter((r) => r.status !== 'submitted').length;
      await sendDiscordMessage(
        `⏰ **Reminder** — LVL ${tournament.lvl} vs **${tournament.opponent}** is still open. ${stillWaiting} player(s) haven't submitted yet!`
      );
      setStatusMsg({ type: 'success', msg: 'Reminder broadcast sent to Discord.' });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'missing-webhook'
          ? 'Discord webhook not configured. Add VITE_DISCORD_WEBHOOK_URL to .env.'
          : 'Could not send reminder.';
      setStatusMsg({ type: 'error', msg });
    } finally {
      setBroadcasting(false);
    }
  };

  const sendDiscordReminder = async (discordId: string, lvl: number | undefined) => {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL as string | undefined;
    if (!webhookUrl) {
      throw new Error('missing-webhook');
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `<@${discordId}> ⏰ Reminder: please submit your result for LVL ${lvl ?? ''}!`,
      }),
    });
    if (!res.ok) throw new Error('webhook-failed');
  };

  const handleRemind = async (row: TournamentPlayer & { player: Player | null }) => {
    const name = row.player?.fc_name || row.fc_name || 'Player';
    const discordId = row.player?.discord_id;
    if (!discordId) {
      setStatusMsg({ type: 'error', msg: `${name} has no Discord ID set.` });
      return;
    }
    setRemindingId(row.id);
    try {
      await sendDiscordReminder(discordId, tournament?.lvl);
      setStatusMsg({ type: 'success', msg: `Reminder sent to ${name} on Discord.` });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'missing-webhook'
          ? 'Discord webhook not configured. Add VITE_DISCORD_WEBHOOK_URL to .env.'
          : `Could not send reminder to ${name}.`;
      setStatusMsg({ type: 'error', msg });
    } finally {
      setRemindingId(null);
    }
  };

  const handleRemindAll = async () => {
    const targets = tpRows.filter((row) => row.status !== 'submitted' && row.player?.discord_id);
    if (targets.length === 0) {
      setStatusMsg({ type: 'error', msg: 'No waiting players have a Discord ID set.' });
      return;
    }
    setRemindingAll(true);
    let sent = 0;
    for (const row of targets) {
      try {
        await sendDiscordReminder(row.player!.discord_id, tournament?.lvl);
        sent++;
      } catch (err) {
        if (err instanceof Error && err.message === 'missing-webhook') {
          setStatusMsg({ type: 'error', msg: 'Discord webhook not configured. Add VITE_DISCORD_WEBHOOK_URL to .env.' });
          setRemindingAll(false);
          return;
        }
      }
    }
    setStatusMsg({ type: sent > 0 ? 'success' : 'error', msg: `Reminded ${sent}/${targets.length} players on Discord.` });
    setRemindingAll(false);
  };

  const handleEditPlayer = async (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.fc_name);
    setEditDiscordId(player.discord_id || '');
    setEditActive(player.active);
  };

  const handleSaveEdit = async () => {
    if (!editingPlayer) return;
    setPlayerAction(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ fc_name: editName.trim(), discord_id: editDiscordId.trim(), active: editActive })
        .eq('id', editingPlayer.id);
      if (error) throw error;
      setStatusMsg({ type: 'success', msg: `Player "${editName.trim()}" updated.` });
      setEditingPlayer(null);
      setPlayerAction(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not update player.' });
      setPlayerAction(false);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    if (!confirm(`Delete player "${player.fc_name}"? This cannot be undone.`)) return;
    setPlayerAction(true);
    try {
      const { error } = await supabase.from('players').delete().eq('id', player.id);
      if (error) throw error;
      setStatusMsg({ type: 'success', msg: `Player "${player.fc_name}" deleted.` });
      setPlayerAction(false);
      loadData();
    } catch {
      setStatusMsg({ type: 'error', msg: 'Could not delete player.' });
      setPlayerAction(false);
    }
  };

  if (!unlocked) {
    return <AdminGate onUnlock={() => setUnlocked(true)} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-blue-400" />
        <span className="text-sm tracking-wide">Loading admin...</span>
      </div>
    );
  }

  const submitted = tpRows.filter((p) => p.status === 'submitted');
  const waiting = tpRows.filter((p) => p.status !== 'submitted');
  const ourScore = submitted.reduce((sum, p) => sum + (p.score || 0), 0);
  const total = tpRows.length;
  const progressPct = total > 0 ? (submitted.length / total) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#03120b]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-black tracking-wide">LVL ADMIN</div>
            <div className="text-[10px] text-green-400 tracking-widest">TOURNAMENT CONTROL</div>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[.08] bg-[#0a1428] text-xs font-bold hover:border-green-500/50 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Status toast */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold ${
            statusMsg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-red-400 bg-red-500/10 border border-red-500/20'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {statusMsg.msg}
        </div>
      )}

      {/* Active Tournament Card */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-5">
        <div className="flex justify-between items-start gap-3">
          <div>
            <div className="text-[11px] text-slate-400 font-bold tracking-widest uppercase">
              Current LVL
            </div>
            <h2 className="text-xl font-black mt-1">
              {tournament ? tournament.opponent || 'UNKNOWN' : 'NO ACTIVE LVL'}
            </h2>
          </div>
          {tournament ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-bold">
              ● ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-[11px] font-bold">
              ● INACTIVE
            </span>
          )}
        </div>

        {tournament && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="min-w-0 bg-[#071126] border border-white/[.06] rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">LVL</div>
                <div className="text-lg font-black mt-1">{tournament.lvl}</div>
              </div>
              <div className="min-w-0 bg-[#071126] border border-white/[.06] rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Our Score</div>
                <div className="text-lg font-black mt-1 text-green-400">{ourScore}</div>
              </div>
              <div className="min-w-0 bg-[#071126] border border-white/[.06] rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Submitted</div>
                <div className="text-lg font-black mt-1">{submitted.length}/{total}</div>
              </div>
              <div className="min-w-0 bg-[#071126] border border-white/[.06] rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Time Left</div>
                <div className="text-base sm:text-lg font-black mt-1 text-yellow-400 tabular-nums truncate">{countdown}</div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                <span>PLAYER SUBMISSIONS</span>
                <span>{submitted.length} / {total}</span>
              </div>
              <div className="w-full h-2.5 bg-[#050c1b] border border-white/[.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-[#72ffc0] rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl border border-green-500/20 bg-green-500/5 text-green-400 text-xs font-bold">
              TOTAL TEAM SCORE: {ourScore}
            </div>

            {/* Discord Announce / Broadcast */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={handleAnnounceStart}
                disabled={announcing}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/15 disabled:opacity-50 transition-all"
              >
                {announcing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                Announce Start
              </button>
              <button
                onClick={handleBroadcastReminder}
                disabled={broadcasting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-bold hover:bg-yellow-500/15 disabled:opacity-50 transition-all"
              >
                {broadcasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                Send Reminder
              </button>
            </div>
            <p className="text-[9px] text-slate-500 mt-1.5">
              "Send Reminder" broadcasts to the whole Discord channel — safe to click as many times during the day as you need.
            </p>

            {/* Submitted players */}
            <div className="mt-4 pt-4 border-t border-white/[.06]">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-black">SUBMITTED PLAYERS</span>
                <span className="text-xs text-slate-400">{submitted.length}</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {submitted.length === 0 ? (
                  <div className="text-slate-400 text-xs py-3">No results submitted yet.</div>
                ) : (
                  submitted.map((row) => {
                    const isEditing = editingScoreId === row.id;
                    return (
                      <div
                        key={row.id}
                        className="flex justify-between items-center gap-2.5 px-3 py-2.5 bg-[#071126] border border-white/[.06] rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {row.player?.fc_name || row.fc_name || 'Unknown'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {row.player?.discord_id ? `Discord: ${row.player.discord_id}` : 'No Discord ID'}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={editScoreValue}
                              onChange={(e) => setEditScoreValue(e.target.value)}
                              autoFocus
                              className="w-14 h-8 px-2 rounded-lg border border-white/[.08] bg-[#050d1d] text-white text-sm font-black text-center outline-none focus:border-green-500/50"
                            />
                            <button
                              onClick={() => handleSaveScore(row)}
                              disabled={savingScore}
                              className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 flex items-center justify-center disabled:opacity-50"
                            >
                              {savingScore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditingScoreId(null)}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-sm font-black text-green-400">
                              {row.score} goal{row.score === 1 ? '' : 's'}
                            </div>
                            <button
                              onClick={() => handleEditScore(row)}
                              className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Waiting players */}
            <div className="mt-4 pt-4 border-t border-white/[.06]">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-black">WAITING FOR RESULTS</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{waiting.length}</span>
                  {waiting.length > 0 && (
                    <button
                      onClick={handleRemindAll}
                      disabled={remindingAll}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-bold hover:bg-blue-500/15 disabled:opacity-50 transition-all"
                    >
                      {remindingAll ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bell className="w-3 h-3" />
                      )}
                      Remind All
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {waiting.length === 0 ? (
                  <div className="text-slate-400 text-xs py-3">Everyone has submitted. ✓</div>
                ) : (
                  waiting.map((row) => (
                    <div
                      key={row.id}
                      className="flex justify-between items-center gap-2.5 px-3 py-2.5 bg-[#071126] border border-yellow-500/15 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {row.player?.fc_name || row.fc_name || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {row.player?.discord_id ? `Discord: ${row.player.discord_id}` : 'No Discord ID'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemind(row)}
                        disabled={remindingId === row.id || remindingAll}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-bold hover:bg-blue-500/15 disabled:opacity-50 transition-all flex-shrink-0"
                      >
                        {remindingId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Bell className="w-3 h-3" />
                        )}
                        Remind
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create New LVL */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-black tracking-wide uppercase">Create New LVL</h3>
        </div>

        {tournament ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/18 bg-yellow-500/5">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-yellow-400 text-xs font-bold">NEW LVL LOCKED</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Finish the current LVL before starting a new one.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3.5">
              <div>
                <label className="block mb-1.5 text-[11px] text-slate-400 uppercase tracking-wide font-bold">
                  LVL Number
                </label>
                <input
                  type="number"
                  value={newLvl}
                  onChange={(e) => setNewLvl(e.target.value)}
                  placeholder="Example: 20"
                  className="w-full px-3 py-3 rounded-lg border border-white/[.08] bg-[#050d1d] text-white text-sm font-bold outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-[11px] text-slate-400 uppercase tracking-wide font-bold">
                  Opponent
                </label>
                <input
                  type="text"
                  value={newOpponent}
                  onChange={(e) => setNewOpponent(e.target.value)}
                  placeholder="Opponent name"
                  className="w-full px-3 py-3 rounded-lg border border-white/[.08] bg-[#050d1d] text-white text-sm font-bold outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] text-slate-400 uppercase tracking-wide font-bold">
                    Select Players
                  </label>
                  <button
                    onClick={selectAll}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold"
                  >
                    {selectedIds.size === allPlayers.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {allPlayers.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedIds.has(p.id)
                          ? 'border-green-500/40 bg-green-500/5'
                          : 'border-white/[.08] bg-[#071126] hover:border-blue-500/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => togglePlayer(p.id)}
                        className="accent-green-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold truncate">{p.fc_name}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Selected: <span className="text-green-400 font-black">{selectedIds.size}</span> / {allPlayers.length}
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={starting || selectedIds.size === 0 || !newLvl || !newOpponent.trim()}
                className="w-full py-3.5 rounded-xl bg-green-500 text-[#03120b] text-sm font-black tracking-wide hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" strokeWidth={2.5} />
                )}
                {starting ? 'STARTING...' : 'START LVL'}
              </button>
              {(!newLvl || !newOpponent.trim()) && selectedIds.size > 0 && (
                <p className="text-[11px] text-yellow-400/80 text-center mt-2">
                  {!newLvl && !newOpponent.trim()
                    ? 'Enter LVL number and opponent name to start'
                    : !newLvl
                    ? 'Enter LVL number to start'
                    : 'Enter opponent name to start'}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Finish & Delete */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-5">
        <div className="text-[11px] text-slate-400 font-bold tracking-widest uppercase mb-2">
          Finish Current LVL
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          When all results are collected, enter the opponent's final score.
          Your team's score is calculated automatically.
        </p>
        <button
          onClick={handleFinish}
          disabled={!tournament || finishing}
          className="w-full py-3 rounded-xl bg-green-500 text-[#03120b] text-sm font-black hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" strokeWidth={2.5} />}
          {finishing ? 'FINISHING...' : 'END LVL'}
        </button>
      </div>

      <div className="rounded-2xl border border-red-500/25 bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-5">
        <div className="text-[11px] text-red-400 font-bold tracking-widest uppercase mb-2">
          Danger Zone
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          Delete the current test LVL and all associated results. This cannot be undone.
        </p>
        <button
          onClick={handleDelete}
          disabled={!tournament || deleting}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-black hover:bg-red-500/15 active:scale-[.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={2.5} />}
          {deleting ? 'DELETING...' : 'DELETE TEST LVL'}
        </button>
      </div>

      {/* Player Management */}
      <div className="rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-xl shadow-black/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-black tracking-wide uppercase">Manage Players</h3>
          </div>
          <button
            onClick={() => setShowPlayerMgr(!showPlayerMgr)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-bold"
          >
            {showPlayerMgr ? 'Hide' : 'Show all'}
          </button>
        </div>

        {/* Add new player */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="FC Name"
            className="w-full sm:flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-white/[.08] bg-[#050d1d] text-white text-xs font-bold outline-none focus:border-blue-500/50 transition-all"
          />
          <input
            type="text"
            value={newPlayerDiscordId}
            onChange={(e) => setNewPlayerDiscordId(e.target.value)}
            placeholder="Discord ID (optional)"
            className="w-full sm:flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-white/[.08] bg-[#050d1d] text-white text-xs font-bold outline-none focus:border-blue-500/50 transition-all"
          />
          <button
            onClick={handleAddPlayer}
            disabled={playerAction}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-500 text-white text-xs font-black hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            {playerAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Add
          </button>
        </div>
        <p className="text-[10px] text-slate-500 -mt-1.5 mb-3">
          Discord ID = the number you get from right-click → Copy User ID on a member (Developer Mode must be on in Discord settings).
        </p>

        {/* Player list */}
        {showPlayerMgr && (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {allPlayers.length === 0 ? (
              <div className="text-slate-400 text-xs py-3 text-center">No players found.</div>
            ) : (
              allPlayers.map((p) => (
                <div
                  key={p.id}
                  className="px-3 py-2.5 bg-[#071126] border border-white/[.06] rounded-lg"
                >
                  {editingPlayer?.id === p.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="FC Name"
                        className="w-full px-2 py-1.5 rounded border border-white/[.08] bg-[#050d1d] text-white text-xs outline-none focus:border-blue-500/50"
                      />
                      <input
                        type="text"
                        value={editDiscordId}
                        onChange={(e) => setEditDiscordId(e.target.value)}
                        placeholder="Discord ID"
                        className="w-full px-2 py-1.5 rounded border border-white/[.08] bg-[#050d1d] text-white text-xs outline-none focus:border-blue-500/50"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="accent-green-500 w-3.5 h-3.5"
                          />
                          Active
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={playerAction}
                            className="px-2.5 py-1.5 rounded bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPlayer(null)}
                            className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{p.fc_name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {p.discord_id ? `Discord: ${p.discord_id}` : 'No Discord ID'}
                          {!p.active && ' • INACTIVE'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditPlayer(p)}
                        className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 transition-colors flex-shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(p)}
                        className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Finish LVL Modal */}
      {showFinishModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => !finishing && setShowFinishModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/[.08] bg-gradient-to-b from-[#0a1428] to-[#071126] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Square className="w-4 h-4 text-red-400" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide">FINISH LVL</h2>
                <p className="text-[10px] text-slate-400">vs {tournament?.opponent}</p>
              </div>
            </div>

            <label className="block mt-5 mb-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-400">
              Opponent's Final Score
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={finishScoreInput}
              onChange={(e) => {
                setFinishScoreInput(e.target.value);
                setFinishModalError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && confirmFinish()}
              placeholder="0"
              autoFocus
              className="w-full h-14 px-4 rounded-2xl border border-white/[.08] bg-[#050d1d] text-white text-2xl font-black text-center outline-none focus:border-red-500/50 transition-all"
            />
            {finishModalError && (
              <p className="text-[11px] text-red-400 mt-2 font-bold">{finishModalError}</p>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowFinishModal(false)}
                disabled={finishing}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-black disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmFinish}
                disabled={finishing}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                {finishing ? 'Finishing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
