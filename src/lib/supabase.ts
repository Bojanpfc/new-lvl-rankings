import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Player = {
  id: string;
  player_id: string;
  fc_name: string;
  discord_id: string;
  active: boolean;
  created_at: string;
};

export type Tournament = {
  id: string;
  lvl: number;
  opponent: string;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'finished';
  our_score: number;
  opponent_score: number;
  result: string | null;
  created_at: string;
};

export type TournamentPlayer = {
  id: string;
  tournament_id: string;
  player_id: string;
  fc_name: string;
  score: number | null;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
  edited_at: string | null;
};

export type RankingRow = {
  id: string;
  name: string;
  games: number;
  total: number;
  average: number;
  maximum: number;
  minimum: number;
  lastFive: { score: number; lvl: number; opponent: string }[];
  allResults: {
    score: number | null;
    lvl: number;
    opponent: string;
    status: string;
    submitted_at: string | null;
  }[];
};
