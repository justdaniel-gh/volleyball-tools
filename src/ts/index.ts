import "./init"

import * as z3 from 'z3-solver';

import { Team } from "./interfaces";
import { calc_three_way_tie } from "./solve"
import { range } from "./utils";
import $ from "cash-dom";
import { create_team, update_pps } from "./team";

// Import our custom CSS
import '../scss/styles.scss'

// Import all of Bootstrap's JS
// TODO: Maybe don't?
import * as bootstrap from 'bootstrap'

declare global {
    interface Window { z3Promise: ReturnType<typeof z3.init>; }
}
window.z3Promise = z3.init();
// so other scripts can Z3 - they just need to `await window.z3Promise`
// this script must be before those scripts on the page

let num_teams = 3;
// Formula for # matches in a RR Pool: N*(N-1)/2
let num_matches = num_teams * (num_teams - 1) / 2;
let num_sets = 3;


function create_table(num_matches: number, num_sets: number) {
    /*
              <tr>
                <th></th>
                <th colspan="3">Match 1</th>
                <th colspan="3">Match 2</th>
                <th colspan="3">Match 3</th>
                <th colspan="4"></th>
              </tr>
              <tr>
                <th></th>
                <th>Set 1</th>
                <th>Set 2</th>
                <th>Set 3</th>
                <th>Set 1</th>
                <th>Set 2</th>
                <th>Set 3</th>
                <th>Set 1</th>
                <th>Set 2</th>
                <th>Set 3</th>
                <th>M%</th>
                <th>S%</th>
                <th>P%</th>
                <th>Winner?</th>
              </tr>
    */
    let table = $("#match-table > thead");
    // Appease type checking...
    if (table === undefined) {
        return;
    }

    let m_row = document.createElement("tr");
    m_row.appendChild(document.createElement("th"));
    let s_row = document.createElement("tr");
    s_row.appendChild(document.createElement("th"));

    range(num_matches, 1).forEach((m) => {
        let th = document.createElement("th");
        th.innerText = "Match " + m;
        th.colSpan = num_sets;
        th.className = "text-center";
        m_row.appendChild(th);
        range(num_sets, 1).forEach((s) => {
            let th = document.createElement("th");
            th.innerText = "S" + s;
            s_row.appendChild(th);
        });
    });
    let m_th = document.createElement("th");
    m_th.innerText = "M%";
    s_row.appendChild(m_th);

    let s_th = document.createElement("th");
    s_th.innerText = "S%";
    s_row.appendChild(s_th);

    let p_th = document.createElement("th");
    p_th.innerText = "P%";
    s_row.appendChild(p_th);

    let w_th = document.createElement("th");
    w_th.innerText = "W?";
    s_row.appendChild(w_th);

    let th = document.createElement("th");
    th.colSpan = 4;
    m_row.appendChild(th);
    table.append(m_row);
    table.append(s_row);
}

function create_teams(num_matches: number, num_sets: number): Team[] {
    let teams: Team[] = range(num_teams, 1).map((id) => create_team(id, num_matches, num_sets));

    return teams;
}

export async function solve() {
    calc_three_way_tie(teams);
}

export function update_teams() {
    // I know. It's hacky.
    // I register update_teams on all change events so I have access to the teams
    // Then call this function to do the updates
    update_pps(teams);
};

create_table(num_matches, num_sets);
let teams = create_teams(num_matches, num_sets);

// Set some default scores for example
$("#t1_m1_s1").val("25");
$("#t1_m1_s2").val("25");
$("#t3_m1_s1").val("18");
$("#t3_m1_s2").val("21");

$("#t2_m2_s1").val("20");
$("#t3_m2_s1").val("25");
$("#t2_m2_s2").val("15");
$("#t3_m2_s2").val("25");

$("#t3_wins").prop("checked", true);
update_teams()

$('#calculate').on("click", solve);
