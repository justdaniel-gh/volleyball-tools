import { update_teams } from ".";
import { Team } from "./interfaces";
import { range, get_val } from "./utils";
import $ from "cash-dom";
import type { Event } from 'cash-dom';

export function create_team(id: number, num_matches: number, num_sets: number): Team {
    let table = $("#match-table > tbody");

    let team: Team = {
        id: id,
        matches_played: 0,
        matches_won: 0,
        sets_won: 0,
        points_scored: 0,
        points_scored_against: 0,
        point_percentage: 0,
        scores: range(num_matches).map(() => range(num_sets).map(() => Number.NaN)),
        z3_scores: range(num_matches).map(() => range(num_sets).map(() => undefined)),
    };

    // Appease type checking...
    if (table === undefined) {
        return team;
    }

    // Create elements
    /*
          <tr>
            <th>Team 1</th>
            <td><input onchange="update_pps()" id="t1_m1_s1" type="text" size="2" value="25"></td>
            <td><input onchange="update_pps()" id="t1_m1_s2" type="text" size="2" value="25"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m1_s3" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m2_s1" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m2_s2" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m2_s3" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m3_s1" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m3_s2" type="text" size="2"></td>
            <td><input onchange="EntryPoint.update_pps()" id="t1_m3_s3" type="text" size="2"></td>
            <td>
              <div id="t1_mp"></div>
            </td>
            <td>
              <div id="t1_sp"></div>
            </td>
            <td>
              <div id="t1_pp"></div>
            </td>
            <td><input type="radio" id="team1" name="winning_team" value=0 /></td>
          </tr>
    */
    let row = $("<tr></tr>");
    row.append(
        $("<th></th>").text("Team " + id)
    );
    range(num_matches, 1).forEach((m) => {
        range(num_sets, 1).forEach((s) => {
            let td = $("<td></td>");
            let input = $("<input></input>").attr({ id: "t" + id + "_m" + m + "_s" + s, type: "text", size: "2" });
            input.on("change", { team: team }, update_teams);
            td.append(input);
            row.append(td);
        });
    });
    row.append($("<td></td>").append($("<div></div>").attr({ id: "t" + id + "_mp" })));
    row.append($("<td></td>").append($("<div></div>").attr({ id: "t" + id + "_sp" })));
    row.append($("<td></td>").append($("<div></div>").attr({ id: "t" + id + "_pp" })));

    let radio = $("<td></td>").append(
        $("<input></input>").attr({
            id: "t" + id + "_wins",
            type: "radio",
            name: "winning_team",
            value: id.toString()
        }))
    row.append(radio);
    table.append(row);
    return team;
}

export function update_pps(teams: Team[]) {
    collect_teams_data(teams);
    teams.forEach((team) => {
        $("#t" + team.id + "_pp").html("" + team.point_percentage.toFixed(4));
    })
}

function collect_teams_data(teams: Team[]) {
    // Reset
    teams.forEach((team) => {
        team.matches_played = 0;
        team.matches_won = 0;
        team.sets_won = 0;
        team.points_scored = 0;
        team.points_scored_against = 0;
        team.point_percentage = 0;
        // [match][set]
        team.scores = [1, 2, 3].map((s) => [Number.NaN, Number.NaN, Number.NaN]);
        team.z3_scores = [1, 2, 3].map((s) => [undefined, undefined, undefined]);
    });

    // Collect up matches, sets, and points
    range(3, 1).map((m, mn) => {
        let sets_won = range(3, 1).map((s, sn) => {
            var t1 = get_val($("#t1_m" + m + "_s" + s));
            var t2 = get_val($("#t2_m" + m + "_s" + s));
            var t3 = get_val($("#t3_m" + m + "_s" + s));
            var points_scored = -1;
            var team_played: Team | null = null;
            if (!Number.isNaN(t1)) {
                // Team 1 played this game
                teams[0].points_scored += t1;
                teams[0].scores[mn][sn] = t1;
                points_scored = t1;
                team_played = teams[0];
            }
            if (!Number.isNaN(t2)) {
                // Team 2 played this game
                teams[1].points_scored += t2;
                teams[1].scores[mn][sn] = t2;
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
                teams[2].scores[mn][sn] = t3;
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
}
