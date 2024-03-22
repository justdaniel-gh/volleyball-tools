import * as z3 from 'z3-solver';
import * as index from './index';
import { Team } from "./interfaces";
import { range } from "./utils";
import $ from "cash-dom";


function build_cmp_rationals(a_num: z3.Arith<"main">, a_den: z3.Arith<"main">, b_num: z3.Arith<"main">, b_den: z3.Arith<"main">) {
    return a_num.mul(b_den).sub(b_num.mul(a_den));
}

async function build_solve_set(context: z3.Context, a_team_score: z3.Arith<"main">, b_team_score: z3.Arith<"main">, third_set: boolean) {
    let { And, Or } = context;

    /* The rules for a set: 
        - each team has  0 <= a score < 50 (reasonable max)
        - one team reaches 25 and the other has 23 or less
        - one team reaches 25 and ther other has 24, must win by 2 points
        * 3rd set is 15 points
     */
    let point_val: number = third_set ? 15 : 25;
    return And(
        a_team_score.ge(0),
        a_team_score.lt(50),
        b_team_score.ge(0),
        b_team_score.lt(50),
        Or(
            // team a gets 25/15, other team is 23/13 or less, set 3 is 0 for both
            And(a_team_score.eq(point_val), b_team_score.le(point_val - 2)),
            // win by 2 over 25/15
            And(
                a_team_score.ge(point_val),
                b_team_score.ge(point_val - 1),
                a_team_score.sub(b_team_score).eq(2),
            ),
            // Or B....
            And(b_team_score.eq(point_val), a_team_score.le(point_val - 2)),
            And(
                b_team_score.ge(point_val),
                a_team_score.ge(point_val - 1),
                b_team_score.sub(a_team_score).eq(2),
            ),
            // Or Both teams are 0 (i.e. set 3 isn't played)
            And(b_team_score.eq(0), a_team_score.eq(0)),
        )
    );
}

async function build_solve_match(context: z3.Context, solver: z3.Optimize, a_team: Team, b_team: Team, match_id: number) {
    let { And, Or, Int } = context;

    let match_ndx = match_id - 1;

    let a_team_scores = range(3, 1).map((s, sn) => {
        let i = Int.const('t' + a_team.id + '_m' + match_id + '_s' + s + '_score');
        if (!Number.isNaN(a_team.scores[match_ndx][sn])) {
            solver.add(i.eq(a_team.scores[match_ndx][sn]));
        }
        // TODO: Do i really need this?
        // It attempts to minimize the scores
        //solver.minimize(i);
        a_team.z3_scores[match_ndx][sn] = i;
        return i;
    });
    let b_team_scores = range(3, 1).map((s, sn) => {
        let i = Int.const('t' + b_team.id + '_m' + match_id + '_s' + s + '_score');
        if (!Number.isNaN(b_team.scores[match_ndx][sn])) {
            solver.add(i.eq(b_team.scores[match_ndx][sn]));
        }
        //solver.minimize(i);
        b_team.z3_scores[match_ndx][sn] = i;
        return i;
    });

    // Add in the set rules
    range(3, 0).forEach(async (sn) => { solver.add(await build_solve_set(context, a_team_scores[sn], b_team_scores[sn], sn == 2)) });

    // Add in the match rules (for all three sets)
    solver.add(Or(
        //    a_team won set 1 and 2; then 3 = 0 for both
        And(a_team_scores[0].gt(b_team_scores[0]), a_team_scores[1].gt(b_team_scores[1]), a_team_scores[2].eq(0), b_team_scores[2].eq(0)),
        // or a_team won set 1 and 3 and lost 2
        And(
            a_team_scores[0].gt(b_team_scores[0]),
            a_team_scores[1].lt(b_team_scores[1]),
            a_team_scores[2].gt(b_team_scores[2]),
        ),
        // or a_team won sets 2 and 3 and lost 1
        And(
            a_team_scores[0].lt(b_team_scores[0]),
            a_team_scores[1].gt(b_team_scores[1]),
            a_team_scores[2].gt(b_team_scores[2]),
        ),
        // Or b team
        And(b_team_scores[0].gt(a_team_scores[0]), b_team_scores[1].gt(a_team_scores[1]), b_team_scores[2].eq(0), a_team_scores[2].eq(0)),
        // or b_team won set 1 and 3 and lost 2
        And(
            b_team_scores[0].gt(a_team_scores[0]),
            b_team_scores[1].lt(a_team_scores[1]),
            b_team_scores[2].gt(a_team_scores[2]),
        ),
        // or b_team won sets 2 and 3 and lost 1
        And(
            b_team_scores[0].lt(a_team_scores[0]),
            b_team_scores[1].gt(a_team_scores[1]),
            b_team_scores[2].gt(a_team_scores[2]),
        ),
    ));

    return [a_team_scores, b_team_scores];
}

export async function calc_three_way_tie(teams: Team[]) {
    $('#result').html("Solving...");
    let { Context } = await window.z3Promise;
    let context = Context('main');
    let { Optimize, And, ToInt } = context;

    console.log(teams);

    // Now, for game 3, we want to come up with a solution where it creates a tie on matches/sets and a certain team wins
    //let solver = new Solver();
    let solver = new Optimize();
    // Who will be playing?
    //  - whichever teams have 1 games played
    // a_team score is > b_team, by 2 points, and >= 25 (or vice versa) 
    // -- for both sets, in this simple case, there can be no 3d set

    const isArith = (item: z3.Arith<"main"> | undefined): item is z3.Arith<"main"> => { return !!item };

    await build_solve_match(context, solver, teams[0], teams[2], 1);
    let match_1_team_1_scored_against = teams[2].z3_scores[0].filter(isArith).reduce((acc, cv) => acc.add(cv));
    let match_1_team_3_scored_against = teams[0].z3_scores[0].filter(isArith).reduce((acc, cv) => acc.add(cv));

    await build_solve_match(context, solver, teams[1], teams[2], 2);
    let match_2_team_2_scored_against = teams[2].z3_scores[1].filter(isArith).reduce((acc, cv) => acc.add(cv));
    let match_2_team_3_scored_against = teams[1].z3_scores[1].filter(isArith).reduce((acc, cv) => acc.add(cv));

    let match_3_scores = await build_solve_match(context, solver, teams[0], teams[1], 3);
    // Only worry about minimizing these scores
    solver.minimize(match_3_scores[0][0]);
    solver.minimize(match_3_scores[1][0]);
    solver.minimize(match_3_scores[0][1]);
    solver.minimize(match_3_scores[1][1]);
    let match_3_team_1_scored_against = teams[1].z3_scores[2].filter(isArith).reduce((acc, cv) => acc.add(cv));
    let match_3_team_2_scored_against = teams[0].z3_scores[2].filter(isArith).reduce((acc, cv) => acc.add(cv));

    // now the pp for both teams has to be less than the team we want to win
    // TODO: if "winner" is in this match, then it needs to be > the other two

    // Instead of actually doing the division, cross multiply and make sure the second ratio is bigger
    // FIXME: assuming team 3 to win, make this actually use the radio button...
    solver.add(And(
        // team 2 has to win match 3!
        match_3_scores[1][0].gt(match_3_scores[0][0]),
        match_3_scores[1][1].gt(match_3_scores[0][1]),
        // AND the point percent for both teams must be less than team 2's!
        build_cmp_rationals(
            // team 1, sum of scores from all matches
            teams[0].z3_scores.flat().filter(isArith).reduce((acc, cv) => acc.add(cv)),
            // team 1, all points scored against
            match_1_team_1_scored_against.add(match_3_team_1_scored_against),
            // team 3, (the wanna be winning team) sum of scores from all matches
            teams[2].z3_scores.flat().filter(isArith).reduce((acc, cv) => acc.add(cv)),
            // team 3, all points scored against
            match_1_team_3_scored_against.add(match_2_team_3_scored_against),
            // We want team 1 pp to be < team 3's
        ).lt(0),
        build_cmp_rationals(
            // team 2, sum of scores from all matches
            teams[1].z3_scores.flat().filter(isArith).reduce((acc, cv) => acc.add(cv)),
            // team 2, all points scored against
            match_2_team_2_scored_against.add(match_3_team_2_scored_against),
            // team 3, (the want to be winning team) sum of scores from all matches
            teams[2].z3_scores.flat().filter(isArith).reduce((acc, cv) => acc.add(cv)),
            // team 3, all points scored against
            match_1_team_3_scored_against.add(match_2_team_3_scored_against),
            // We want team 2 pp to be < team 3's
        ).lt(0)
    ));

    /*
    let output = '';
    for (const entry of solver.assertions().entries()) {
        output += '' + entry + '<br/>';
    }
    $('#assertions').html(output);
    */
    if (await solver.check() == 'sat') {
        $('#t1_m3_s1').val('' + solver.model().get(teams[0].z3_scores[2][0] as z3.Arith<"main">));
        $('#t1_m3_s2').val('' + solver.model().get(teams[0].z3_scores[2][1] as z3.Arith<"main">));
        $('#t2_m3_s1').val('' + solver.model().get(teams[1].z3_scores[2][0] as z3.Arith<"main">));
        $('#t2_m3_s2').val('' + solver.model().get(teams[1].z3_scores[2][1] as z3.Arith<"main">)).trigger("change");
        //$('#result').html('' + solver.model());
        $('#result').html('Solved!');
    } else {
        $('#result').html('Unable to solve!');
    }
};