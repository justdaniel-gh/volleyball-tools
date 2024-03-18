import * as z3 from 'z3-solver';
import * as $ from "jquery";

declare global {
    interface Window { z3Promise: ReturnType<typeof z3.init>; }
}
window.z3Promise = z3.init();
// so other scripts can Z3 - they just need to `await window.z3Promise`
// this script must be before those scripts on the page

interface Team {
    id: number;
    matches_played: number;
    matches_won: number;
    sets_won: number;
    points_scored: number;
    points_scored_against: number;
    point_percentage: number;
}

function get_val(selected: JQuery): number {
    let val = selected.val();
    if (val == "") {
        return Number.NaN;
    }
    return Number(val);
}

export async function calc_three_way_tie() {
    $('#result').html("Solving... this can take a minute or two...");
    let { Context } = await window.z3Promise;
    let { Optimize, Int, And, Or, ToReal } = Context('main');

    let teams: Team[] = [1, 2, 3].map((id) => ({ id: id, matches_played: 0, matches_won: 0, sets_won: 0, points_scored: 0, points_scored_against: 0, point_percentage: 0 }));

    // Collect up matches, sets, and points
    [1, 2].map((m) => {
        let sets_won = [1, 2, 3].map(s => {
            var t1 = get_val($("#t1_m" + m + "_s" + s));
            var t2 = get_val($("#t2_m" + m + "_s" + s));
            var t3 = get_val($("#t3_m" + m + "_s" + s));
            var points_scored = -1;
            var team_played: Team | null = null;
            if (!Number.isNaN(t1)) {
                // Team 1 played this game
                teams[0].points_scored += t1;
                points_scored = t1;
                team_played = teams[0];
            }
            if (!Number.isNaN(t2)) {
                // Team 2 played this game
                teams[1].points_scored += t2;
                if (team_played != null) {
                    team_played.points_scored_against += t2;
                    teams[1].points_scored_against += points_scored;
                    if (t2 > points_scored) {
                        teams[1].sets_won += 1;
                        return teams[1];
                    } else {
                        team_played.sets_won += 1;
                        return team_played;
                    }
                }
                points_scored = t2;
                team_played = teams[1];
            }
            if (!Number.isNaN(t3)) {
                // Team 3 played this game
                teams[2].points_scored += t3;
                if (team_played != null) {
                    team_played.points_scored_against += t3;
                    teams[2].points_scored_against += points_scored;
                    if (t3 > points_scored) {
                        teams[2].sets_won += 1;
                        return teams[2];
                    } else {
                        team_played.sets_won += 1;
                        return team_played;
                    }
                }
            }
        })
        // Collect games won (most number of sets)
        if (sets_won[0] != undefined && (sets_won[0] == sets_won[1] || sets_won[0] == sets_won[2])) {
            sets_won[0].matches_won += 1;
        } else if (sets_won[2] != undefined) {
            sets_won[2].matches_won += 1;
        }
    });
    // Calculate pp
    teams.forEach((team) => { team.point_percentage = team.points_scored / team.points_scored_against });
    console.log(teams);

    // Now, for game 3, we want to come up with a solution where it creates a tie on matches/sets and a certain team wins
    //let solver = new Solver();
    let solver = new Optimize();
    // Who will be playing?
    //  - whichever teams have 1 games played
    let a_team_s1_score = Int.const('a_team_s1_score');
    let b_team_s1_score = Int.const('b_team_s1_score');

    let a_team_s2_score = Int.const('a_team_s2_score');
    let b_team_s2_score = Int.const('b_team_s2_score');
    // a_team score is > b_team, by 2 points, and >= 25 (or vice versa) 
    // -- for both sets, in this simple case, there can be no 3d set
    // TODO: Support 3 sets

    // minimum and reasonably maximum scores
    solver.add(And(
        a_team_s1_score.ge(0),
        a_team_s2_score.ge(0),
        b_team_s1_score.ge(0),
        b_team_s2_score.ge(0),
        a_team_s1_score.lt(40),
        a_team_s2_score.lt(40),
        b_team_s1_score.lt(40),
        b_team_s2_score.lt(40),
    ))
    // rules for winning a match
    solver.add(
        Or(
            // A team wins
            And(
                Or(
                    // team a gets 25, other team is 23 or less
                    And(a_team_s1_score.eq(25), b_team_s1_score.le(23)),
                    // win by 2 over 25
                    And(
                        a_team_s1_score.gt(25),
                        b_team_s1_score.gt(23),
                        a_team_s1_score.sub(b_team_s1_score).eq(2),
                    ),
                ),
                Or(
                    // same, set 2
                    And(a_team_s2_score.eq(25), b_team_s2_score.le(23)),
                    And(
                        a_team_s2_score.gt(25),
                        b_team_s2_score.gt(23),
                        a_team_s2_score.sub(b_team_s2_score).eq(2),
                    ),
                ),
            ),
            // Or B team wins
            And(
                Or(
                    And(b_team_s1_score.eq(25), a_team_s1_score.le(23)),
                    And(
                        b_team_s1_score.gt(25),
                        a_team_s1_score.gt(23),
                        b_team_s1_score.sub(a_team_s1_score).eq(2),
                    ),
                ),
                Or(
                    And(b_team_s2_score.eq(25), a_team_s2_score.le(23)),
                    And(
                        b_team_s2_score.gt(25),
                        a_team_s2_score.gt(23),
                        b_team_s2_score.sub(a_team_s2_score).eq(2),
                    ),
                ),
            ),
        ));
    // now the pp for both teams has to be less than the team we want to win
    // TODO: if "winner" is in this match, then it needs to be > the other two
    solver.add(And(
        ToReal(a_team_s1_score
            .add(a_team_s2_score.add(teams[0].points_scored)))
            .div(ToReal(b_team_s1_score
                .add(b_team_s2_score.add(teams[0].points_scored_against))))
            .lt(teams[2].point_percentage),
        ToReal(b_team_s1_score
            .add(b_team_s2_score)
            .add(teams[1].points_scored))
            .div(ToReal(a_team_s1_score
                .add(a_team_s2_score)
                .add(teams[1].points_scored_against)))
            .lt(teams[2].point_percentage),
    ));
    solver.minimize(a_team_s1_score);
    solver.minimize(a_team_s2_score);
    //solver.minimize(b_team_s1_score);
    //solver.minimize(b_team_s2_score);
    if (!Number.isNaN(get_val($("#t1_m3_s1")))) {
        solver.add(a_team_s1_score.eq(get_val($("#t1_m3_s1"))));
    }
    if (!Number.isNaN(get_val($("#t1_m3_s2")))) {
        solver.add(a_team_s2_score.eq(get_val($("#t1_m3_s2"))));
    }
    if (!Number.isNaN(get_val($("#t2_m3_s1")))) {
        solver.add(b_team_s1_score.eq(get_val($("#t2_m3_s1"))));
    }
    if (!Number.isNaN(get_val($("#t2_m3_s2")))) {
        solver.add(b_team_s2_score.eq(get_val($("#t2_m3_s2"))));
    }

    $('#result').html(await solver.check());
    $('#t1_m3_s1').val('' + solver.model().get(a_team_s1_score));
    $('#t1_m3_s2').val('' + solver.model().get(a_team_s2_score));
    $('#t2_m3_s1').val('' + solver.model().get(b_team_s1_score));
    $('#t2_m3_s2').val('' + solver.model().get(b_team_s2_score));
    
    // TODO:....
    //$("#t1_pp").html(""+teams[0].point_percentage);
    //$("#t2_pp").html(""+teams[1].point_percentage);
    //$("#t3_pp").html(""+teams[2].point_percentage);
};