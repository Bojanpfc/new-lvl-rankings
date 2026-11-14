import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';
import {
  Shield, RefreshCw, Trophy, Users, Clock, Lock, Play, Square, Trash2,
  CheckCircle2, Loader2, AlertCircle, UserPlus, Pencil, X, Bell, Check, KeyRound, Send,
} from 'lucide-react';
import {
  postImage, drawResultImage, drawRankingImage, loadSeasonRows, normSeason, seasonName,
  type ResultImageData,
} from '@/lib/discordImages';

const ADMIN_SESSION_KEY = 'fc-mobile-admin-unlocked';

// Neon Violet theme tokens
const CARD = 'rounded-2xl bg-[#1a1547] border border-[#b48cff]/[.18] shadow-[0_0_28px_rgba(255,79,216,.12)]';
const INPUT = 'border border-[#b48cff]/[.18] bg-[#15113a] text-white outline-none focus:border-[#ff4fd8]/70 transition-all';
const INNER = 'bg-[#15113a] border border-[#b48cff]/[.12]';
const PRIMARY = 'bg-gradient-to-r from-[#ff4fd8] to-[#b66bff] text-white shadow-lg shadow-[#ff4fd8]/30';
const CYAN_BTN = 'border border-[#6ee7ff]/30 bg-[#6ee7ff]/10 text-[#6ee7ff] hover:bg-[#6ee7ff]/15';
const MUTED = 'text-[#9a92c9]';

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
      <div className={`relative overflow-hidden ${CARD} !rounded-3xl p-6 text-center`}>
        <span className="pointer-events-none absolute -right-3 -bottom-10 text-[120px] leading-none opacity-[.10]">⚽</span>
        <div className="relative w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#ff4fd8]/10 border border-[#ff4fd8]/30 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-[#ff8ae6]" />
        </div>
        <h2 className="relative text-base font-black tracking-wide">ADMIN ACCESS</h2>
        <p className={`relative text-xs ${MUTED} mt-1.5 mb-4`}>Enter the admin PIN to continue.</p>
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
          className={`relative w-full h-12 px-4 rounded-xl ${INPUT} text-center text-lg font-black tracking-[6px]`}
        />
        {error && <p className="relative text-[11px] text-red-400 mt-2 font-bold">{error}</p>}
        <button
          onClick={handleSubmit}
          className={`relative w-full mt-4 py-3 rounded-xl ${PRIMARY} text-sm font-black hover:-translate-y-0.5 active:scale-[.98] transition-all`}
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
  const [latestSeason, setLatestSeason] = useState('season-21');

  // Create form
  const [newLvl, setNewLvl] = useState('');
  const [newOpponent, setNewOpponent] = useState('');
  const [newSeason, setNewSeason] = useState('season-21');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishScoreInput, setFinishScoreInput] = useState('');
  const [finishModalError, setFinishModalError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [doneInfo, setDoneInfo] = useState<ResultImageData | null>(null);
  const [sendingImg, setSendingImg] = useState<'result' | 'ranking' | null>(null);
  const [finishedList, setFinishedList] = useState<Tournament[]>([]);
  const [discordSeason, setDiscordSeason] = useState('');
  const [discordTid, setDiscordTid] = useState('');
  const [loadingFinished, setLoadingFinished] = useState(false);

  // Player management
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

  // Layout + remembered player selection
  const [tab, setTab] = useState<'live' | 'new' | 'players' | 'discord' | null>(null);
  const [listView, setListView] = useState<'waiting' | 'submitted'>('waiting');
  const [lastPlayerIds, setLastPlayerIds] = useState<Set<string> | null>(null);
  const [selectionTouched, setSelectionTouched] = useState(false);

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

      const { data: lastT } = await supabase
        .from('tournaments')
        .select('id, season')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastTyped = lastT as { id?: string; season?: string } | null;
      const latestRaw = lastTyped?.season || 'season-21';
      if (lastTyped?.id) {
        const { data: lastTp } = await supabase
          .from('tournament_players')
          .select('player_id')
          .eq('tournament_id', lastTyped.id);
        setLastPlayerIds(new Set(((lastTp || []) as { player_id: string }[]).map((r) => r.player_id)));
      } else {
        setLastPlayerIds(new Set());
      }
      const latest = `season-${Number(latestRaw.match(/\d+/)?.[0] || 21)}`;
      setLatestSeason(latest);
      setNewSeason((prev) => (prev === 'season-21' ? latest : prev));

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

  // Finished LVLs for the Discord tab (loaded only when that tab is opened)
  useEffect(() => {
    if (tab !== 'discord') return;
    let cancelled = false;
    setLoadingFinished(true);
    supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setFinishedList((data || []) as Tournament[]);
        setLoadingFinished(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

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

  // Pre-select the players from the previous LVL until the admin changes the selection.
  useEffect(() => {
    if (selectionTouched || lastPlayerIds === null || allPlayers.length === 0) return;
    const next = new Set(allPlayers.filter((p) => lastPlayerIds.has(p.id)).map((p) => p.id));
    if (next.size > 0) setSelectedIds(next);
  }, [lastPlayerIds, allPlayers, selectionTouched]);

  const togglePlayer = (id: string) => {
    setSelectionTouched(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectionTouched(true);
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
    const seasonNum = Number(newSeason.match(/\d+/)?.[0]);
    if (!seasonNum || seasonNum < 1) {
      setStatusMsg({ type: 'error', msg: 'Please enter a valid season number.' });
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
          season: `season-${seasonNum}`,
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
      setSelectionTouched(false);
      setTab('live');
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

      // Snapshot for the optional "send image to Discord" step (nothing is sent automatically)
      setDoneInfo({
        lvl: tournament.lvl,
        season: tournament.season || 'season-21',
        opponent: tournament.opponent || '',
        ourScore,
        opponentScore: score,
        result: result as 'win' | 'loss' | 'draw',
        date: new Date().toLocaleDateString(),
        players: tpRows.map((p) => ({
          name: p.player?.fc_name || p.fc_name || 'Unknown',
          score: p.status === 'submitted' ? p.score ?? 0 : null,
        })),
      });

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
        `<@&1496058335756292137> 🚨 **New LVL Started!** LVL ${tournament.lvl} vs **${tournament.opponent}** — go play your match! You have 24h.`
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
      await sendDiscordMessage(
        `<@&1496058335756292137> ⏰ **Reminder** — LVL ${tournament.lvl} vs **${tournament.opponent}** is still open. Don't forget to play your match if you haven't yet!`
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

  const imgError = (err: unknown, fallback: string) =>
    err instanceof Error && err.message === 'missing-webhook'
      ? 'Results webhook not configured. Add VITE_DISCORD_RESULTS_WEBHOOK_URL to .env.'
      : fallback;

  const handleSendResultImage = async () => {
    if (!doneInfo) return;
    setSendingImg('result');
    try {
      const blob = await drawResultImage(doneInfo);
      await postImage(blob, `lvl-${doneInfo.lvl}-result.png`);
      setStatusMsg({ type: 'success', msg: 'Result image sent to Discord.' });
    } catch (err) {
      setStatusMsg({ type: 'error', msg: imgError(err, 'Could not send result image.') });
    } finally {
      setSendingImg(null);
    }
  };

  const handleSendRankingImage = async () => {
    if (!doneInfo) return;
    setSendingImg('ranking');
    try {
      const season = normSeason(doneInfo.season);
      const rows = await loadSeasonRows(season);
      if (rows.length === 0) {
        setStatusMsg({ type: 'error', msg: 'No ranking data for this season yet.' });
      } else {
        const blob = await drawRankingImage(rows, seasonName(season));
        await postImage(blob, `ranking-${season}.png`);
        setStatusMsg({ type: 'success', msg: 'Ranking image sent to Discord.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', msg: imgError(err, 'Could not send ranking image.') });
    } finally {
      setSendingImg(null);
    }
  };

  // ---- Discord tab: pick a season / LVL and send on demand ----
  const discordSeasons = Array.from(new Set(finishedList.map((t) => normSeason(t.season)))).sort(
    (a, b) => Number(b.match(/\d+/)?.[0] || 0) - Number(a.match(/\d+/)?.[0] || 0)
  );
  const selSeason = discordSeason && discordSeasons.includes(discordSeason) ? discordSeason : discordSeasons[0] || '';
  const seasonLvls = finishedList.filter((t) => normSeason(t.season) === selSeason);
  const selTid = discordTid && seasonLvls.some((t) => t.id === discordTid) ? discordTid : seasonLvls[0]?.id || '';

  const sendSeasonRanking = async () => {
    if (!selSeason) return;
    setSendingImg('ranking');
    setStatusMsg(null);
    try {
      const rows = await loadSeasonRows(selSeason);
      if (rows.length === 0) {
        setStatusMsg({ type: 'error', msg: 'No ranking data for this season yet.' });
      } else {
        const blob = await drawRankingImage(rows, seasonName(selSeason));
        await postImage(blob, `ranking-${selSeason}.png`);
        setStatusMsg({ type: 'success', msg: `Ranking image (${seasonName(selSeason)}) sent to Discord.` });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', msg: imgError(err, 'Could not send ranking image.') });
    } finally {
      setSendingImg(null);
    }
  };

  const sendLvlResult = async () => {
    const t = finishedList.find((x) => x.id === selTid);
    if (!t) return;
    setSendingImg('result');
    setStatusMsg(null);
    try {
      const { data, error } = await supabase
        .from('tournament_players')
        .select('*, player:players(*)')
        .eq('tournament_id', t.id);
      if (error) throw error;
      const rows = (data || []) as (TournamentPlayer & { player: Player | null })[];
      const blob = await drawResultImage({
        lvl: t.lvl,
        season: t.season || 'season-21',
        opponent: t.opponent || '',
        ourScore: t.our_score,
        opponentScore: t.opponent_score,
        result: t.result === 'win' || t.result === 'loss' || t.result === 'draw' ? t.result : null,
        date: new Date(t.created_at).toLocaleDateString(),
        players: rows.map((p) => ({ name: p.player?.fc_name || p.fc_name || 'Unknown', score: p.score })),
      });
      await postImage(blob, `lvl-${t.lvl}-result.png`);
      setStatusMsg({ type: 'success', msg: `LVL ${t.lvl} result image sent to Discord.` });
    } catch (err) {
      setStatusMsg({ type: 'error', msg: imgError(err, 'Could not send result image.') });
    } finally {
      setSendingImg(null);
    }
  };

  if (!unlocked) {
    return <AdminGate onUnlock={() => setUnlocked(true)} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-[#ff4fd8]" />
        <span className="text-sm tracking-wide">Loading admin...</span>
      </div>
    );
  }

  const submitted = tpRows.filter((p) => p.status === 'submitted');
  const waiting = tpRows.filter((p) => p.status !== 'submitted');
  const ourScore = submitted.reduce((sum, p) => sum + (p.score || 0), 0);
  const total = tpRows.length;
  const progressPct = total > 0 ? (submitted.length / total) * 100 : 0;

  const activeTab = tab ?? (tournament ? 'live' : 'new');
  const tabs: { id: 'live' | 'new' | 'players' | 'discord'; label: string; icon: typeof Clock }[] = [
    { id: 'live', label: 'Live', icon: Clock },
    { id: 'new', label: 'New', icon: Play },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'discord', label: 'Discord', icon: Send },
  ];
  const lastCount = lastPlayerIds ? allPlayers.filter((p) => lastPlayerIds.has(p.id)).length : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
      {/* Header */}
      <div className={`relative overflow-hidden flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#3a1b8f] via-[#2a1470] to-[#1a1547] border border-[#b48cff]/[.18] shadow-[0_0_28px_rgba(255,79,216,.12)] px-3.5 py-3`}>
        <span className="pointer-events-none absolute -right-2 -bottom-9 text-[110px] leading-none opacity-[.14]">⚽</span>
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff4fd8] to-[#b66bff] flex items-center justify-center shadow-lg shadow-[#ff4fd8]/30">
            <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-black tracking-wide text-sm text-white">LVL ADMIN</div>
            <div className="text-[9px] text-white/70 tracking-widest">TOURNAMENT CONTROL</div>
          </div>
        </div>
        <button
          onClick={loadData}
          className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border border-[#b48cff]/[.18] bg-[#15113a]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-black transition-all ${
              activeTab === id ? PRIMARY : `${MUTED} hover:text-white`
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
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

      {/* LIVE TAB */}
      {activeTab === 'live' &&
        (tournament ? (
          <div className={`${CARD} p-4`}>
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black truncate">{tournament.opponent || 'UNKNOWN'}</h2>
                <div className={`text-[10px] ${MUTED} font-bold uppercase tracking-wide mt-0.5`}>
                  {tournament.season || 'season-21'} · LVL {tournament.lvl}
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold flex-shrink-0">
                ● ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mt-3">
              <div className={`min-w-0 ${INNER} rounded-lg py-2 text-center`}>
                <div className={`text-[8px] ${MUTED} uppercase tracking-wide font-bold`}>Score</div>
                <div className="text-base font-black text-[#ff8ae6]">{ourScore}</div>
              </div>
              <div className={`min-w-0 ${INNER} rounded-lg py-2 text-center`}>
                <div className={`text-[8px] ${MUTED} uppercase tracking-wide font-bold`}>Submitted</div>
                <div className="text-base font-black">{submitted.length}/{total}</div>
              </div>
              <div className={`min-w-0 ${INNER} rounded-lg py-2 text-center`}>
                <div className={`text-[8px] ${MUTED} uppercase tracking-wide font-bold`}>Avg</div>
                <div className="text-base font-black">
                  {submitted.length > 0 ? (ourScore / submitted.length).toFixed(1) : '—'}
                </div>
              </div>
              <div className={`min-w-0 ${INNER} rounded-lg py-2 text-center`}>
                <div className={`text-[8px] ${MUTED} uppercase tracking-wide font-bold`}>Left</div>
                <div className="text-[11px] font-black text-yellow-400 tabular-nums truncate leading-6">{countdown}</div>
              </div>
            </div>

            <div className="mt-3 w-full h-2 bg-[#0c0724] border border-[#b48cff]/[.12] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff4fd8] to-[#6ee7ff] shadow-[0_0_10px_rgba(255,79,216,.6)] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-3">
              <button
                onClick={handleAnnounceStart}
                disabled={announcing}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-xl ${CYAN_BTN} text-[10px] font-black disabled:opacity-50 transition-all`}
              >
                {announcing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                Announce
              </button>
              <button
                onClick={handleBroadcastReminder}
                disabled={broadcasting}
                className="flex items-center justify-center gap-1 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-[10px] font-black hover:bg-yellow-500/15 disabled:opacity-50 transition-all"
              >
                {broadcasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                Reminder
              </button>
              <button
                onClick={handleFinish}
                disabled={finishing}
                className="flex items-center justify-center gap-1 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-black hover:bg-red-500/15 disabled:opacity-50 transition-all"
              >
                {finishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" strokeWidth={2.5} />}
                End LVL
              </button>
            </div>
            <p className={`text-[9px] ${MUTED} mt-1.5`}>
              Announce and Reminder post to the whole Discord channel. Reminder is safe to send as often as you need.
            </p>

            <div className="grid grid-cols-2 gap-1.5 mt-4">
              <button
                onClick={() => setListView('waiting')}
                className={`py-2 rounded-lg border text-[11px] font-black transition-all ${
                  listView === 'waiting'
                    ? 'border-[#ff4fd8]/50 text-[#ff8ae6] bg-[#ff4fd8]/10'
                    : `border-[#b48cff]/[.18] ${MUTED} bg-[#15113a]`
                }`}
              >
                Waiting ({waiting.length})
              </button>
              <button
                onClick={() => setListView('submitted')}
                className={`py-2 rounded-lg border text-[11px] font-black transition-all ${
                  listView === 'submitted'
                    ? 'border-[#ff4fd8]/50 text-[#ff8ae6] bg-[#ff4fd8]/10'
                    : `border-[#b48cff]/[.18] ${MUTED} bg-[#15113a]`
                }`}
              >
                Submitted ({submitted.length})
              </button>
            </div>

            {listView === 'waiting' ? (
              <div className="mt-2">
                {waiting.length > 0 && (
                  <div className="flex justify-end mb-1.5">
                    <button
                      onClick={handleRemindAll}
                      disabled={remindingAll}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${CYAN_BTN} text-[10px] font-bold disabled:opacity-50 transition-all`}
                    >
                      {remindingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                      Remind all
                    </button>
                  </div>
                )}
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {waiting.length === 0 ? (
                    <div className={`${MUTED} text-xs py-3 text-center`}>Everyone has submitted. ✓</div>
                  ) : (
                    waiting.map((row) => (
                      <div
                        key={row.id}
                        className="flex justify-between items-center gap-2 px-3 py-2 bg-[#15113a] border border-yellow-500/15 rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {row.player?.fc_name || row.fc_name || 'Unknown'}
                          </div>
                          <div className={`text-[9px] ${MUTED} truncate`}>
                            {row.player?.discord_id ? `Discord: ${row.player.discord_id}` : 'No Discord ID'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemind(row)}
                          disabled={remindingId === row.id || remindingAll}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${CYAN_BTN} text-[10px] font-bold disabled:opacity-50 transition-all flex-shrink-0`}
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
            ) : (
              <div className="mt-2 space-y-1 max-h-72 overflow-y-auto pr-1">
                {submitted.length === 0 ? (
                  <div className={`${MUTED} text-xs py-3 text-center`}>No results submitted yet.</div>
                ) : (
                  submitted.map((row) => {
                    const isEditing = editingScoreId === row.id;
                    return (
                      <div
                        key={row.id}
                        className={`flex justify-between items-center gap-2 px-3 py-2 ${INNER} rounded-lg`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {row.player?.fc_name || row.fc_name || 'Unknown'}
                          </div>
                          <div className={`text-[9px] ${MUTED} truncate`}>
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
                              className={`w-14 h-8 px-2 rounded-lg ${INPUT} text-sm font-black text-center`}
                            />
                            <button
                              onClick={() => handleSaveScore(row)}
                              disabled={savingScore}
                              className="w-8 h-8 rounded-lg bg-[#ff4fd8]/15 border border-[#ff4fd8]/40 text-[#ff8ae6] flex items-center justify-center disabled:opacity-50"
                            >
                              {savingScore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditingScoreId(null)}
                              className={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 ${MUTED} flex items-center justify-center`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-sm font-black text-[#ff8ae6]">
                              {row.score} goal{row.score === 1 ? '' : 's'}
                            </div>
                            <button
                              onClick={() => handleEditScore(row)}
                              className={`w-7 h-7 rounded-lg bg-white/5 border border-white/10 ${MUTED} hover:text-[#6ee7ff] flex items-center justify-center transition-colors`}
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
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="block mx-auto mt-4 text-[10px] text-red-400/80 hover:text-red-400 font-bold disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete this LVL'}
            </button>
          </div>
        ) : (
          <div className={`${CARD} p-6 text-center`}>
            <Trophy className={`w-9 h-9 mx-auto mb-2 ${MUTED}`} />
            <h2 className="text-base font-black tracking-wide">NO ACTIVE LVL</h2>
            <p className={`text-xs ${MUTED} mt-1.5 mb-4`}>Start the next one from the New LVL tab.</p>
            <button
              onClick={() => setTab('new')}
              className={`px-5 py-2.5 rounded-xl ${PRIMARY} text-xs font-black hover:-translate-y-0.5 active:scale-[.98] transition-all`}
            >
              CREATE NEW LVL
            </button>
          </div>
        ))}

      {/* NEW LVL TAB */}
      {activeTab === 'new' && (
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-[#ff4fd8]" />
            <h3 className="text-sm font-black tracking-wide uppercase">Create New LVL</h3>
          </div>

          {tournament ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-yellow-400 text-xs font-bold">NEW LVL LOCKED</div>
                <div className={`${MUTED} text-[11px] mt-0.5`}>
                  Finish the current LVL before starting a new one.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block mb-1 text-[10px] ${MUTED} uppercase tracking-wide font-bold`}>
                    LVL Number
                  </label>
                  <input
                    type="number"
                    value={newLvl}
                    onChange={(e) => setNewLvl(e.target.value)}
                    placeholder="20"
                    className={`w-full px-3 py-2.5 rounded-lg ${INPUT} text-sm font-bold`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 text-[10px] ${MUTED} uppercase tracking-wide font-bold`}>
                    Season
                  </label>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={newSeason.match(/\d+/)?.[0] ?? ''}
                    onChange={(e) => setNewSeason(e.target.value ? `season-${e.target.value}` : '')}
                    placeholder="22"
                    className={`w-full px-3 py-2.5 rounded-lg ${INPUT} text-sm font-bold`}
                  />
                </div>
              </div>
              <p className={`text-[10px] ${MUTED} -mt-1`}>
                Pre-filled as <span className="text-white font-bold">{latestSeason}</span>, the same as your last LVL.
                Change it only on the first LVL of a new season.
              </p>

              <div>
                <label className={`block mb-1 text-[10px] ${MUTED} uppercase tracking-wide font-bold`}>
                  Opponent
                </label>
                <input
                  type="text"
                  value={newOpponent}
                  onChange={(e) => setNewOpponent(e.target.value)}
                  placeholder="Opponent name"
                  className={`w-full px-3 py-2.5 rounded-lg ${INPUT} text-sm font-bold`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`text-[10px] ${MUTED} uppercase tracking-wide font-bold`}>
                    Players ({selectedIds.size}/{allPlayers.length})
                  </label>
                  <button onClick={selectAll} className="text-[10px] text-[#6ee7ff] hover:text-[#a5f3fc] font-bold">
                    {selectedIds.size === allPlayers.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {allPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlayer(p.id)}
                      className={`px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all ${
                        selectedIds.has(p.id)
                          ? 'border-[#ff4fd8]/50 bg-[#ff4fd8]/[.12] text-[#ff8ae6]'
                          : `border-white/[.08] ${MUTED} hover:border-white/20`
                      }`}
                    >
                      {p.fc_name}
                    </button>
                  ))}
                </div>
                {!selectionTouched && lastCount > 0 && (
                  <p className={`text-[10px] ${MUTED} mt-1.5`}>
                    Pre-selected the {lastCount} players from your last LVL. Tap a name to add or remove it.
                  </p>
                )}
              </div>

              <button
                onClick={handleStart}
                disabled={starting || selectedIds.size === 0 || !newLvl || !newOpponent.trim()}
                className={`w-full py-3 rounded-xl ${PRIMARY} text-sm font-black tracking-wide hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2`}
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" strokeWidth={2.5} />}
                {starting ? 'STARTING...' : 'START LVL'}
              </button>
              {(!newLvl || !newOpponent.trim()) && selectedIds.size > 0 && (
                <p className="text-[11px] text-yellow-400/80 text-center">
                  {!newLvl && !newOpponent.trim()
                    ? 'Enter LVL number and opponent name to start'
                    : !newLvl
                    ? 'Enter LVL number to start'
                    : 'Enter opponent name to start'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* PLAYERS TAB */}
      {activeTab === 'players' && (
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#6ee7ff]" />
            <h3 className="text-sm font-black tracking-wide uppercase">Manage Players</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="FC Name"
              className={`w-full sm:flex-1 min-w-0 px-3 py-2.5 rounded-lg ${INPUT} text-xs font-bold`}
            />
            <input
              type="text"
              value={newPlayerDiscordId}
              onChange={(e) => setNewPlayerDiscordId(e.target.value)}
              placeholder="Discord ID (optional)"
              className={`w-full sm:flex-1 min-w-0 px-3 py-2.5 rounded-lg ${INPUT} text-xs font-bold`}
            />
            <button
              onClick={handleAddPlayer}
              disabled={playerAction}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-lg ${PRIMARY} text-xs font-black hover:-translate-y-0.5 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 flex-shrink-0`}
            >
              {playerAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>
          <p className={`text-[10px] ${MUTED} mb-3`}>
            Discord ID = the number you get from right-click → Copy User ID on a member (Developer Mode must be on in Discord settings).
          </p>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {allPlayers.length === 0 ? (
              <div className={`${MUTED} text-xs py-3 text-center`}>No players found.</div>
            ) : (
              allPlayers.map((p) => (
                <div key={p.id} className={`px-3 py-2 ${INNER} rounded-lg`}>
                  {editingPlayer?.id === p.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="FC Name"
                        className={`w-full px-2 py-1.5 rounded ${INPUT} text-xs`}
                      />
                      <input
                        type="text"
                        value={editDiscordId}
                        onChange={(e) => setEditDiscordId(e.target.value)}
                        placeholder="Discord ID"
                        className={`w-full px-2 py-1.5 rounded ${INPUT} text-xs`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className={`flex items-center gap-1.5 text-[10px] ${MUTED}`}>
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="accent-[#ff4fd8] w-3.5 h-3.5"
                          />
                          Active
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={playerAction}
                            className="px-2.5 py-1.5 rounded bg-[#ff4fd8]/15 border border-[#ff4fd8]/40 text-[#ff8ae6] text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPlayer(null)}
                            className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 ${MUTED} text-[10px] font-bold`}
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
                        <div className={`text-[9px] ${MUTED} truncate`}>
                          {p.discord_id ? `Discord: ${p.discord_id}` : 'No Discord ID'}
                          {!p.active && ' • INACTIVE'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditPlayer(p)}
                        className={`px-2 py-1.5 rounded bg-white/5 border border-white/10 ${MUTED} hover:text-[#6ee7ff] transition-colors flex-shrink-0`}
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
        </div>
      )}

      {/* DISCORD TAB */}
      {activeTab === 'discord' && (
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4 text-[#6ee7ff]" />
            <h3 className="text-sm font-black tracking-wide uppercase">Discord Images</h3>
          </div>
          <p className={`text-[10px] ${MUTED} mb-4`}>
            Images are posted to the results channel only when you tap a button here.
          </p>

          {loadingFinished ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-[#ff4fd8]" />
            </div>
          ) : discordSeasons.length === 0 ? (
            <div className={`${MUTED} text-xs py-4 text-center`}>No finished LVLs yet.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={`block mb-1 text-[10px] ${MUTED} uppercase tracking-wide font-bold`}>Season</label>
                <select
                  value={selSeason}
                  onChange={(e) => {
                    setDiscordSeason(e.target.value);
                    setDiscordTid('');
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg ${INPUT} text-sm font-bold`}
                >
                  {discordSeasons.map((sn) => (
                    <option key={sn} value={sn} className="bg-[#15113a]">
                      {seasonName(sn)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${INNER} rounded-xl p-3`}>
                <div className="text-[10px] font-black tracking-wide uppercase mb-2">Ranking table</div>
                <p className={`text-[10px] ${MUTED} mb-2`}>All ranked players of the selected season.</p>
                <button
                  onClick={sendSeasonRanking}
                  disabled={!!sendingImg}
                  className={`w-full py-2.5 rounded-xl ${PRIMARY} text-xs font-black tracking-wide disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {sendingImg === 'ranking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  SEND RANKING IMAGE
                </button>
              </div>

              <div className={`${INNER} rounded-xl p-3`}>
                <div className="text-[10px] font-black tracking-wide uppercase mb-2">LVL result</div>
                <select
                  value={selTid}
                  onChange={(e) => setDiscordTid(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg ${INPUT} text-xs font-bold mb-2`}
                >
                  {seasonLvls.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#15113a]">
                      LVL {t.lvl} · {t.opponent} · {t.our_score}:{t.opponent_score}
                    </option>
                  ))}
                </select>
                <button
                  onClick={sendLvlResult}
                  disabled={!!sendingImg || !selTid}
                  className={`w-full py-2.5 rounded-xl ${CYAN_BTN} text-xs font-black tracking-wide disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {sendingImg === 'result' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  SEND RESULT IMAGE
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LVL finished: optional Discord images (sent only on click) */}
      {doneInfo && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => !sendingImg && setDoneInfo(null)}
        >
          <div
            className="relative overflow-hidden w-full max-w-sm rounded-3xl border border-[#b48cff]/[.18] bg-gradient-to-b from-[#1b1450] to-[#0c0724] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pointer-events-none absolute -right-3 -bottom-10 text-[120px] leading-none opacity-[.10]">⚽</span>
            <div className="relative flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-400" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide">LVL {doneInfo.lvl} FINISHED</h2>
                <p className={`text-[10px] ${MUTED}`}>
                  {doneInfo.ourScore} : {doneInfo.opponentScore} vs {doneInfo.opponent}
                </p>
              </div>
            </div>
            <p className={`relative text-xs ${MUTED} mt-4 leading-relaxed`}>
              Check the total against the game first. Images are posted to Discord only when you tap a button.
            </p>

            <div className="relative space-y-2 mt-4">
              <button
                onClick={handleSendResultImage}
                disabled={!!sendingImg}
                className={`w-full py-3 rounded-xl ${PRIMARY} text-xs font-black tracking-wide hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2`}
              >
                {sendingImg === 'result' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                SEND RESULT IMAGE
              </button>
              <button
                onClick={handleSendRankingImage}
                disabled={!!sendingImg}
                className={`w-full py-3 rounded-xl ${CYAN_BTN} text-xs font-black tracking-wide disabled:opacity-50 transition-all flex items-center justify-center gap-2`}
              >
                {sendingImg === 'ranking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                SEND RANKING IMAGE
              </button>
              <button
                onClick={() => setDoneInfo(null)}
                disabled={!!sendingImg}
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {statusMsg && (
              <div
                className={`relative flex items-center gap-2 mt-3 p-3 rounded-xl text-[11px] font-bold ${
                  statusMsg.type === 'success'
                    ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                    : 'text-red-400 bg-red-500/10 border border-red-500/20'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                {statusMsg.msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish LVL Modal */}
      {showFinishModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => !finishing && setShowFinishModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[#b48cff]/[.18] bg-gradient-to-b from-[#1b1450] to-[#0c0724] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Square className="w-4 h-4 text-red-400" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide">FINISH LVL</h2>
                <p className={`text-[10px] ${MUTED}`}>vs {tournament?.opponent}</p>
              </div>
            </div>

            <label className={`block mt-5 mb-2 text-[10px] font-extrabold tracking-widest uppercase ${MUTED}`}>
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
              className={`w-full h-14 px-4 rounded-2xl ${INPUT} text-2xl font-black text-center`}
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
