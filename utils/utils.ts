// The "Event Name" - What physically happened?
export enum HandballAction {
  // Shots
  GOAL = 'goal',
  SAVE = 'save',
  MISS = 'miss',
  BLOCK = 'block',
  POST = 'post',
  SEVEN_M_GOAL = '7m_goal',
  SEVEN_M_MISS = '7m_miss',

  // Sanctions
  YELLOW_CARD = 'yellow_card',
  RED_CARD = 'red_card',
  TWO_MINUTES = 'two_minutes',
  BLUE_CARD = 'blue_card',

  // Violations / Turnovers (The "Variable" events)
  BAD_PASS = 'bad_pass',
  STEPS = 'steps',
  PASSIVE_PLAY = 'passive_play',
  OFFENSIVE_FOUL = 'offensive_foul',
  INTERCEPTED = 'intercepted',

  // Game Management
  SUBSTITUTION = 'substitution',
  TIMEOUT = 'timeout',
  START_HALF = 'start_of_half',
  END_HALF = 'end_of_half',
}

// The "Tags" - The context or outcome
export enum EventTag {
  // Categories
  SHOT = 'shot',
  SANCTION = 'sanction',
  TURNOVER = 'turnover',
  TACTICAL = 'tactical',
  ADMIN = 'admin',

  // Outcomes
  SCORE = 'score',
  NO_SCORE = 'no_score',
  CARD = 'card',
  SUSPENSION = 'suspension',
  SET_PIECE = 'set_piece',
  VIOLATION = 'violation',
}

// Base interface for all events
interface BaseEvent {
  id: string;
  matchTime: string; // "14:02"
  playerId?: string;
  teamId: string;
}

// 1. Strict Shot Events: Must have 'SHOT' tag
interface ShotEvent extends BaseEvent {
  action: 
    | HandballAction.GOAL 
    | HandballAction.SAVE 
    | HandballAction.MISS 
    | HandballAction.BLOCK 
    | HandballAction.POST
    | HandballAction.SEVEN_M_GOAL
    | HandballAction.SEVEN_M_MISS;
  
  // We enforce that these MUST carry the SHOT tag
  tags: (EventTag.SHOT | EventTag.SCORE | EventTag.NO_SCORE | EventTag.SET_PIECE)[];
}

// 2. Strict Sanction Events: Must have 'SANCTION' tag
interface SanctionEvent extends BaseEvent {
  action: 
    | HandballAction.YELLOW_CARD 
    | HandballAction.RED_CARD 
    | HandballAction.TWO_MINUTES 
    | HandballAction.BLUE_CARD;
  
  tags: (EventTag.SANCTION | EventTag.CARD | EventTag.SUSPENSION)[];
}

// 3. Variable Outcome Events (The "Bad Pass" scenario)
// These allow OPTIONAL tags like 'TURNOVER'
interface PlayEvent extends BaseEvent {
  action: 
    | HandballAction.BAD_PASS 
    | HandballAction.STEPS 
    | HandballAction.PASSIVE_PLAY
    | HandballAction.INTERCEPTED;

  // Notice we allow generic EventTags here, giving us flexibility
  tags: EventTag[]; 
}

// 4. Admin/Tactical Events
interface GameEvent extends BaseEvent {
  action: HandballAction.SUBSTITUTION | HandballAction.TIMEOUT | HandballAction.START_HALF;
  tags: (EventTag.ADMIN | EventTag.TACTICAL)[];
}

// This is the Discriminated Union
export type HandballEvent = ShotEvent | SanctionEvent | PlayEvent | GameEvent;

// A collection of events
const matchLog: HandballEvent[] = [];

// Example 1: A Standard Goal (Strict Types)
const goalEvent: HandballEvent = {
  id: "001",
  matchTime: "10:00",
  teamId: "Home",
  action: HandballAction.GOAL,
  // Typescript will complain if I forget 'SHOT' here because of the ShotEvent interface
  tags: [EventTag.SCORE] 
};

// Example 2: A Bad Pass that WAS a turnover
const fatalError: HandballEvent = {
  id: "002",
  matchTime: "10:45",
  teamId: "Away",
  action: HandballAction.BAD_PASS,
  tags: [EventTag.TURNOVER] // We explicitly add the tag
};

// Example 3: A Bad Pass that was RECOVERED (No turnover tag)
const luckyError: HandballEvent = {
  id: "003",
  matchTime: "10:50",
  teamId: "Away",
  action: HandballAction.BAD_PASS,
  tags: [] // Empty tags: It happened, but no statistical consequence
};

matchLog.push(goalEvent, fatalError, luckyError);