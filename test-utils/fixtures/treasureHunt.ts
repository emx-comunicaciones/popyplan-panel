/**
 * Fixtures de la búsqueda del tesoro con la forma real de
 * `treasure_hunt/serializers.py` (admin de plataforma, bloque 2).
 */
import type {
  TreasureCompletion,
  TreasureGame,
  TreasureGameDetail,
  TreasureParticipant,
  TreasurePrizeTier,
  TreasureRankingRow,
  TreasureStep,
} from "@/lib/api/types";

export const GAME_ID = "0b6f3a52-7c1e-4d8a-9f3e-2a1b5c6d7e8f";
export const EVENT_ID = "5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d";

export function buildTreasureGame(overrides: Partial<TreasureGame> = {}): TreasureGame {
  return {
    id: GAME_ID,
    name: "Búsqueda del tesoro de Donostia",
    description: "Recorre la Parte Vieja resolviendo pistas.",
    city: "Donostia",
    prize_description: "Un fin de semana de surf",
    start_time: "2030-10-10T10:00:00Z",
    duration_minutes: 120,
    game_mode: "individual",
    team_size_min: 2,
    team_size_max: 5,
    max_participants: 50,
    status: "draft",
    status_display: "Borrador",
    is_featured: false,
    image: null,
    participants_count: 0,
    is_joinable: false,
    steps_count: 0,
    created_by_username: "plataforma",
    event_id: null,
    my_team_id: null,
    my_team_is_ready_to_play: null,
    my_team_chat_room_id: null,
    my_team_capacity: null,
    created_at: "2026-09-26T08:00:00Z",
    ...overrides,
  };
}

export function buildTreasureGameDetail(overrides: Partial<TreasureGameDetail> = {}): TreasureGameDetail {
  return { ...buildTreasureGame(), steps: [], teams: [], prize_tiers: [], my_welcome_seen: false, ...overrides };
}

export function buildTreasureStep(overrides: Partial<TreasureStep> = {}): TreasureStep {
  return {
    id: "a1111111-1111-4111-8111-111111111111",
    order: 1,
    clue: "Donde el peine del viento canta",
    hint: "Al final de Ondarreta",
    challenge_type: "answer",
    challenge_type_display: "Respuesta de texto",
    latitude: null,
    longitude: null,
    location_radius_meters: 100,
    points_base: 10,
    time_bonus_seconds: 300,
    ...overrides,
  };
}

export function buildTreasurePrizeTier(overrides: Partial<TreasurePrizeTier> = {}): TreasurePrizeTier {
  return {
    id: "b2222222-2222-4222-8222-222222222222",
    rank_from: 1,
    rank_to: 1,
    tier_name: "Primer premio",
    description: "Fin de semana de surf",
    ...overrides,
  };
}

export function buildTreasureParticipant(overrides: Partial<TreasureParticipant> = {}): TreasureParticipant {
  return {
    id: 7,
    user_id: 13,
    username: "p01",
    first_name: "Persona",
    last_name: "Uno",
    full_name: "Persona Uno",
    profile_picture: null,
    status: "pending",
    status_display: "Pendiente",
    team_id: null,
    team_name: null,
    joined_at: "2026-09-26T09:00:00Z",
    ...overrides,
  };
}

export function buildTreasureCompletion(overrides: Partial<TreasureCompletion> = {}): TreasureCompletion {
  return {
    id: "c3333333-3333-4333-8333-333333333333",
    step_order: 2,
    step_clue: "Hazte una foto con la estatua",
    challenge_type: "photo",
    team_id: "d4444444-4444-4444-8444-444444444444",
    team_name: "Persona Uno",
    answer: "",
    photo: "/media/treasure_hunt/completions/foto.jpg",
    points_earned: 0,
    time_taken_seconds: 90,
    is_valid: false,
    completed_at: "2026-10-10T10:30:00Z",
    ...overrides,
  };
}

export function buildTreasureRankingRow(overrides: Partial<TreasureRankingRow> = {}): TreasureRankingRow {
  return {
    id: "d4444444-4444-4444-8444-444444444444",
    team_id: "d4444444-4444-4444-8444-444444444444",
    name: "Persona Uno",
    team_name: "Persona Uno",
    rank: 1,
    score: 35,
    finished_at: null,
    steps_completed: 3,
    members_count: 1,
    capacity: 1,
    game_mode: "individual",
    ...overrides,
  };
}
