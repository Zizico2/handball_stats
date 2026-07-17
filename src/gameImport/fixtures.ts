import {
  ARCAZZI_GAME_V1_HEADERS,
  LEGACY_EVENT_LOG_V0_HEADERS,
} from "./csvContract";

export const V1_HEADER_LINE = ARCAZZI_GAME_V1_HEADERS.join(",");
export const LEGACY_HEADER_LINE = LEGACY_EVENT_LOG_V0_HEADERS.join(",");

export const VALID_V1_FIXTURE = [
  V1_HEADER_LINE,
  "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,Rivals HC,,,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,7,Ana Silva,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,9,Bruna Costa,,,,,,,,,,",
  "arcazzi-game-v1,player,,,,,11,Carla Dias,,,,,,,,,,",
  "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,",
  "arcazzi-game-v1,event,match-1,,,,9,,1,firstHalf,240,shot,attack,false,OffTarget,,6m+,",
  "arcazzi-game-v1,event,match-1,,,,7,,2,secondHalf,120,substitution,substitution,,,,,11",
  "arcazzi-game-v1,event,match-1,,,,11,,3,secondHalf,300,interception,defense,,,,,",
  "",
].join("\n");

export const VALID_LEGACY_FIXTURE = [
  LEGACY_HEADER_LINE,
  "7,95,shot,attack,firstHalf,true,OnTarget,TopLeft,9m+,",
  "9,240,shot,attack,firstHalf,false,OffTarget,,6m+,",
  "7,120,substitution,substitution,secondHalf,,,,,11",
  "",
].join("\n");

export const LEGACY_ROSTER = [
  { number: 7, name: "Ana Silva" },
  { number: 9, name: "Bruna Costa" },
  { number: 11, name: "Carla Dias" },
];
