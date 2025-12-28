//These are the types used currently in the tournament app. They are subject to change at any point.
//This is here to get a sense of how the data is structured and what fields can be expected.


export interface Player {
    id: string;
    name: string;
    isCaptain: boolean;
    uma: string;
}

export interface Wildcard {
    playerId: string;
    group: 'A' | 'B' | 'C' | 'Finals';
}

export interface Team {
    id: string;
    captainId: string;
    memberIds: string[];
    name: string;
    points: number;
    finalsPoints: number;
    group: 'A' | 'B' | 'C';
    inFinals?: boolean;
    color?: string;
}

export interface Race {
    id: string;
    stage: 'groups' | 'finals';
    group: 'A' | 'B' | 'C';
    raceNumber: number;
    timestamp: string;
    placements: Record<string, number>; // playerId: position
}

export interface Tournament {
    id: string;
    name: string;
    password?: string; // this is a legacy field, which is no longer in use for new tournaments. some old tournaments may have it sitll.
    status: 'registration' | 'draft' | 'active' | 'ban' | 'completed';
    stage: 'groups' | 'finals';
    players: Player[];
    wildcards?: Wildcard[];
    teams: Team[];
    races: Race[];
    bans?: string[];
    createdAt: string;
    draft?: {
        order: string[];
        currentIdx: number;
    };
    isSecured?: boolean;
}