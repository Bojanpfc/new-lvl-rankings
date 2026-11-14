// Save as: src/lib/discordImages.ts
import { supabase, type Tournament, type TournamentPlayer, type Player } from '@/lib/supabase';

type TP = TournamentPlayer & { player: Player | null };

export type ResultImageData = {
  lvl: number;
  season: string;
  opponent: string;
  ourScore: number;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw' | null;
  date: string;
  players: { name: string; score: number | null }[]; // score === null means "not submitted"
};

export type RankRow = {
  name: string;
  games: number;
  avg: number;
  max: number;
  min: number;
  last5: number[];
};

export function normSeason(raw: string | null | undefined) {
  const s = (raw || 'season-21').trim().toLowerCase();
  const n = s.match(/\d+/)?.[0];
  return n ? `season-${Number(n)}` : s;
}

export function seasonName(id: string) {
  if (id === 'all' || id === 'all-time') return 'All Seasons';
  const n = id.match(/\d+/)?.[0];
  return n ? `Season ${n}` : id;
}

/* ---------- ranking data ---------- */

export function buildRankRows(items: { players: TP[] }[]): RankRow[] {
  const map = new Map<string, { name: string; res: { score: number; at: number }[] }>();
  items.forEach((it) =>
    it.players.forEach((p) => {
      if (p.score === null || p.score === undefined) return;
      const cur = map.get(p.player_id) || { name: p.player?.fc_name || p.fc_name || 'Unknown', res: [] };
      cur.res.push({ score: p.score, at: p.submitted_at ? new Date(p.submitted_at).getTime() : 0 });
      map.set(p.player_id, cur);
    })
  );
  return Array.from(map.values())
    .map((v) => {
      const res = [...v.res].sort((a, b) => b.at - a.at);
      const scores = res.map((r) => r.score);
      const total = scores.reduce((s, x) => s + x, 0);
      return {
        name: v.name,
        games: scores.length,
        avg: total / scores.length,
        max: Math.max(...scores),
        min: Math.min(...scores),
        last5: scores.slice(0, 5),
        total,
      };
    })
    .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.games !== a.games) return b.games - a.games;
      if (b.total !== a.total) return b.total - a.total;
      if (b.max !== a.max) return b.max - a.max;
      return a.name.localeCompare(b.name);
    })
    .map(({ total: _t, ...row }) => row);
}

export async function loadSeasonRows(season: string): Promise<RankRow[]> {
  const { data: tData, error } = await supabase.from('tournaments').select('*').eq('status', 'finished');
  if (error) throw error;
  const ts = ((tData || []) as Tournament[]).filter((t) => normSeason(t.season) === season);
  const ids = new Set(ts.map((t) => t.id));
  const all: TP[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase
      .from('tournament_players')
      .select('*, player:players(*)')
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (e) throw e;
    const rows = (data || []) as TP[];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return buildRankRows([{ players: all.filter((p) => ids.has(p.tournament_id)) }]);
}

/* ---------- webhook ---------- */

export async function postImage(blob: Blob, filename: string, content?: string) {
  const url = import.meta.env.VITE_DISCORD_RESULTS_WEBHOOK_URL as string | undefined;
  if (!url) throw new Error('missing-webhook');
  const form = new FormData();
  if (content) form.append('content', content);
  form.append('file', blob, filename);
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('webhook-failed');
}

/* ---------- canvas helpers ---------- */

const F = 'system-ui, -apple-system, "Segoe UI", sans-serif';
type Ctx = CanvasRenderingContext2D;

function rr(x: Ctx, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

function bg(x: Ctx, W: number, H: number) {
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1b1450');
  g.addColorStop(0.55, '#120c34');
  g.addColorStop(1, '#0c0a1f');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 420);
  r.addColorStop(0, 'rgba(255,79,216,.28)');
  r.addColorStop(1, 'rgba(255,79,216,0)');
  x.fillStyle = r;
  x.fillRect(0, 0, W, H);
  const c = x.createRadialGradient(0, H * 0.3, 0, 0, H * 0.3, 360);
  c.addColorStop(0, 'rgba(110,231,255,.14)');
  c.addColorStop(1, 'rgba(110,231,255,0)');
  x.fillStyle = c;
  x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.07;
  x.font = `260px ${F}`;
  x.fillStyle = '#fff';
  x.textAlign = 'left';
  x.fillText('⚽', W - 300, H - 20);
  x.globalAlpha = 1;
}

function tx(x: Ctx, s: string, a: number, b: number, font: string, col: string | CanvasGradient, al: CanvasTextAlign = 'left') {
  x.font = font;
  x.fillStyle = col;
  x.textAlign = al;
  x.fillText(s, a, b);
}

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('canvas-failed'))), 'image/png'));
}

const rankFill = (i: number) => (i === 0 ? '#ffbf2e' : i === 1 ? '#cbd5e1' : i === 2 ? '#e39a5c' : '#241d5e');

/* ---------- result image ---------- */

export async function drawResultImage(d: ResultImageData): Promise<Blob> {
  const W = 1000;
  const scored = d.players.filter((p) => p.score !== null).sort((a, b) => (b.score || 0) - (a.score || 0));
  const waiting = d.players.filter((p) => p.score === null).map((p) => p.name);
  const rows = Math.ceil(scored.length / 2);

  // lay out the "waiting" pills first so we know the canvas height
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = `700 16px ${F}`;
  const pills: { name: string; x: number; line: number; w: number }[] = [];
  let px = 40;
  let line = 0;
  waiting.forEach((n) => {
    const w = m.measureText(n).width + 26;
    if (px + w > W - 40) {
      px = 40;
      line++;
    }
    pills.push({ name: n, x: px, line, w });
    px += w + 8;
  });
  const waitH = waiting.length ? 50 + (line + 1) * 38 : 0;
  const H = 330 + rows * 46 + waitH + 50;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  bg(x, W, H);

  tx(x, 'FC MOBILE · LVL SYSTEM', 40, 52, `800 18px ${F}`, '#ff8ae6');
  tx(x, `${seasonName(normSeason(d.season)).toUpperCase()} · LVL ${d.lvl}`, W - 40, 52, `800 18px ${F}`, 'rgba(255,255,255,.7)', 'right');
  tx(x, 'GOATS', 250, 130, `800 22px ${F}`, 'rgba(255,255,255,.7)', 'center');
  tx(x, (d.opponent || 'OPPONENT').toUpperCase().slice(0, 22), 750, 130, `800 22px ${F}`, 'rgba(255,255,255,.7)', 'center');
  tx(x, String(d.ourScore), 250, 215, `900 100px ${F}`, '#fff', 'center');
  tx(x, String(d.opponentScore), 750, 215, `900 100px ${F}`, 'rgba(255,255,255,.5)', 'center');
  tx(x, ':', 500, 200, `900 80px ${F}`, 'rgba(255,255,255,.35)', 'center');

  if (d.result) {
    rr(x, 430, 226, 140, 38, 19);
    const g = x.createLinearGradient(430, 0, 570, 0);
    if (d.result === 'win') {
      g.addColorStop(0, '#22c55e');
      g.addColorStop(1, '#4ade80');
    } else if (d.result === 'loss') {
      g.addColorStop(0, '#ef4444');
      g.addColorStop(1, '#f87171');
    } else {
      g.addColorStop(0, '#94a3b8');
      g.addColorStop(1, '#cbd5e1');
    }
    x.fillStyle = g;
    x.fill();
    tx(x, d.result.toUpperCase(), 500, 253, `900 20px ${F}`, '#0b0b14', 'center');
  }

  const avg = scored.length ? d.ourScore / scored.length : 0;
  if (scored.length) {
    const mvp = scored[0];
    tx(x, `👑 MVP ${mvp.name} · ${mvp.score} goals     AVG ${avg.toFixed(2)}`, 500, 300, `800 19px ${F}`, '#facc15', 'center');
  }

  const mx = scored[0]?.score || 1;
  scored.forEach((p, i) => {
    const col = i < rows ? 0 : 1;
    const row = i % rows;
    const X = 40 + col * 470;
    const Y = 330 + row * 46;
    rr(x, X, Y, 450, 38, 12);
    x.fillStyle = 'rgba(26,21,71,.85)';
    x.fill();
    x.strokeStyle = 'rgba(180,140,255,.22)';
    x.lineWidth = 1.5;
    x.stroke();
    rr(x, X + 8, Y + 7, 24, 24, 8);
    x.fillStyle = rankFill(i);
    x.fill();
    tx(x, String(i + 1), X + 20, Y + 25, `900 14px ${F}`, i < 3 ? '#2b1a00' : '#9a92c9', 'center');
    tx(x, p.name.slice(0, 16), X + 44, Y + 25, `800 17px ${F}`, '#fff');
    const bw = 120;
    const bx = X + 250;
    rr(x, bx, Y + 15, bw, 8, 4);
    x.fillStyle = 'rgba(12,7,36,.9)';
    x.fill();
    const gg = x.createLinearGradient(bx, 0, bx + bw, 0);
    gg.addColorStop(0, '#ff4fd8');
    gg.addColorStop(1, '#6ee7ff');
    rr(x, bx, Y + 15, Math.max(8, (bw * (p.score || 0)) / mx), 8, 4);
    x.fillStyle = gg;
    x.fill();
    tx(x, String(p.score), X + 435, Y + 26, `900 19px ${F}`, '#ff8ae6', 'right');
  });

  if (waiting.length) {
    const top = 330 + rows * 46 + 14;
    tx(x, `WAITING (${waiting.length})`, 40, top + 14, `800 14px ${F}`, '#9a92c9');
    pills.forEach((p) => {
      const Y = top + 28 + p.line * 38;
      rr(x, p.x, Y, p.w, 30, 15);
      x.fillStyle = 'rgba(255,255,255,.04)';
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.14)';
      x.lineWidth = 1;
      x.stroke();
      tx(x, p.name, p.x + 13, Y + 21, `700 16px ${F}`, '#7d76a8');
    });
  }

  tx(x, d.date, 40, H - 18, `700 14px ${F}`, 'rgba(255,255,255,.4)');
  return toBlob(c);
}

/* ---------- ranking image ---------- */

export async function drawRankingImage(rows: RankRow[], label: string): Promise<Blob> {
  const list = rows.slice(0, 15);
  const W = 1000;
  const H = 150 + list.length * 56 + 60;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  bg(x, W, H);

  tx(x, 'PLAYER RANKING', 40, 62, `900 34px ${F}`, '#fff');
  tx(x, label.toUpperCase(), 40, 92, `800 16px ${F}`, '#ff8ae6');
  const cols: [string, number][] = [['#', 40], ['PLAYER', 100], ['GP', 430], ['AVG', 520], ['MAX', 610], ['MIN', 690], ['LAST 5', 780]];
  cols.forEach(([k, px]) => tx(x, k, px + (k === '#' ? 14 : 0), 134, `800 13px ${F}`, '#9a92c9', k === '#' ? 'center' : 'left'));

  list.forEach((p, i) => {
    const Y = 148 + i * 56;
    rr(x, 30, Y, 940, 48, 14);
    x.fillStyle = 'rgba(26,21,71,.88)';
    x.fill();
    x.strokeStyle = 'rgba(180,140,255,.2)';
    x.lineWidth = 1.5;
    x.stroke();
    rr(x, 40, Y + 9, 30, 30, 9);
    x.fillStyle = rankFill(i);
    x.fill();
    tx(x, String(i + 1), 55, Y + 31, `900 16px ${F}`, i < 3 ? '#2b1a00' : '#9a92c9', 'center');
    tx(x, p.name.slice(0, 18), 100, Y + 31, `800 20px ${F}`, '#fff');
    tx(x, String(p.games), 430, Y + 31, `700 18px ${F}`, '#9a92c9');
    const gg = x.createLinearGradient(520, 0, 590, 0);
    gg.addColorStop(0, '#ff4fd8');
    gg.addColorStop(1, '#6ee7ff');
    tx(x, p.avg.toFixed(2), 520, Y + 32, `900 22px ${F}`, gg);
    tx(x, String(p.max), 610, Y + 31, `800 18px ${F}`, '#e2e8f0');
    tx(x, String(p.min), 690, Y + 31, `800 18px ${F}`, '#e2e8f0');
    p.last5.forEach((v, k) => {
      const cx = 780 + k * 36;
      const ok = v >= 34;
      rr(x, cx, Y + 11, 30, 26, 8);
      x.fillStyle = ok ? 'rgba(110,231,255,.2)' : 'rgba(239,68,68,.22)';
      x.fill();
      x.strokeStyle = ok ? 'rgba(110,231,255,.5)' : 'rgba(239,68,68,.55)';
      x.lineWidth = 1.2;
      x.stroke();
      tx(x, String(v), cx + 15, Y + 30, `900 14px ${F}`, ok ? '#6ee7ff' : '#fca5a5', 'center');
    });
  });

  tx(x, 'FC MOBILE · LVL SYSTEM', W / 2, H - 18, `700 13px ${F}`, 'rgba(255,255,255,.4)', 'center');
  return toBlob(c);
}
