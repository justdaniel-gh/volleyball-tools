import * as z3 from 'z3-solver';

export interface Team {
    id: number;
    matches_played: number;
    matches_won: number;
    sets_won: number;
    points_scored: number;
    points_scored_against: number;
    point_percentage: number;
    // [match][set]
    scores: number[][];
    z3_scores: (z3.Arith<"main"> | undefined)[][];
}
