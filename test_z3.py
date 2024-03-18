from dataclasses import dataclass
from z3 import *

"""
    a_team_s1_score = Int.const('a_team_s1_score')
    b_team_s1_score = Int.const('b_team_s1_score')

    a_team_s2_score = Int.const('a_team_s2_score')
    b_team_s2_score = Int.const('b_team_s2_score')
    // a_team score is > b_team, by 2 points, and >= 25 (or vice versa) 
    // -- for both sets, in this simple case, there can be no 3d set
    // TODO: Support 3 sets
    solver + And(a_team_s1_score >= 0), a_team_s2_score >= 0), b_team_s1_score >= 0), b_team_s2_score >= 0)))
    solver + 
        Or(
            // A team wins
            And(
                a_team_s1_score.sub(b_team_s1_score) >= 2),
                a_team_s1_score >= 25),
                a_team_s2_score.sub(b_team_s2_score) >= 2),
                a_team_s2_score >= 25),
            ),
            // Or B team wins
            And(
                b_team_s1_score.sub(a_team_s1_score) >= 2),
                b_team_s1_score >= 25),
                b_team_s2_score.sub(a_team_s2_score) >= 2),
                b_team_s2_score >= 25),
            ),
        ))
    // now the pp for both teams has to be less than the team we want to win
    solver + And(
        a_team_s1_score
             + a_team_s2_score)
             + teams[0].points_scored)
            .div(b_team_s1_score
                 + b_team_s2_score)
                 + teams[0].points_scored_against))
            .lt(teams[2].point_percentage),
        b_team_s1_score
             + b_team_s2_score)
             + teams[1].points_scored)
            .div(a_team_s1_score
                 + a_team_s2_score)
                 + teams[1].points_scored_against))
            .lt(teams[2].point_percentage),
    ))

[
  {
    "id": 1,
    "matches_played": 0,
    "matches_won": 1,
    "sets_won": 2,
    "points_scored": 50,
    "points_scored_against": 39,
    "point_percentage": 1.2820512820512822
  },
  {
    "id": 2,
    "matches_played": 0,
    "matches_won": 0,
    "sets_won": 0,
    "points_scored": 35,
    "points_scored_against": 50,
    "point_percentage": 0.7
  },
  {
    "id": 3,
    "matches_played": 0,
    "matches_won": 1,
    "sets_won": 2,
    "points_scored": 89,
    "points_scored_against": 85,
    "point_percentage": 1.0470588235294118
  }
]
    """


@dataclass
class Team:
    id: int
    matches_played: int
    matches_won: int
    sets_won: int
    points_scored: int
    points_scored_against: int
    point_percentage: float


teams = [
    Team(1, 0, 1, 2, 50, 39, 1.28205),
    Team(2, 0, 0, 0, 35, 50, 0.7),
    Team(3, 0, 1, 2, 89, 85, 1.04705),
]
solver = Optimize()
a_team_s1_score = Int("a_team_s1_score")
b_team_s1_score = Int("b_team_s1_score")

a_team_s2_score = Int("a_team_s2_score")
b_team_s2_score = Int("b_team_s2_score")
# a_team score is > b_team, by 2 points, and >= 25 (or vice versa)
# -- for both sets, in this simple case, there can be no 3d set
# TODO: Support 3 sets

# setup minimum scores, and reasonable maximums
solver.add(
    And(
        a_team_s1_score >= 0,
        a_team_s2_score >= 0,
        b_team_s1_score >= 0,
        b_team_s2_score >= 0,
        a_team_s1_score < 40,
        a_team_s2_score < 40,
        b_team_s1_score < 40,
        b_team_s2_score < 40,
    )
)
# setup the rules for winning a game
solver.add(
    Or(
        And(
            Or(
                # team a gets 25, other team is 23 or less
                And(a_team_s1_score == 25, b_team_s1_score <= 23),
                # win by 2 over 25
                And(
                    a_team_s1_score > 25,
                    b_team_s1_score > 23,
                    a_team_s1_score - b_team_s1_score == 2,
                ),
            ),
            Or(
                # same, set 2
                And(a_team_s2_score == 25, b_team_s2_score <= 23),
                And(
                    a_team_s2_score > 25,
                    b_team_s2_score > 23,
                    a_team_s2_score - b_team_s2_score == 2,
                ),
            ),
        ),
        # same, but b team
        And(
            Or(
                And(b_team_s1_score == 25, a_team_s1_score <= 23),
                And(
                    b_team_s1_score > 25,
                    a_team_s1_score > 23,
                    b_team_s1_score - a_team_s1_score == 2,
                ),
            ),
            Or(
                And(b_team_s2_score == 25, a_team_s2_score <= 23),
                And(
                    b_team_s2_score > 25,
                    a_team_s2_score > 23,
                    b_team_s2_score - a_team_s2_score == 2,
                ),
            ),
        ),
    )
)
# now add in the point percentage magic
solver.add(
    And(
        (
            ToReal(a_team_s1_score + a_team_s2_score + teams[0].points_scored)
            / ToReal(b_team_s1_score + b_team_s2_score + teams[0].points_scored_against)
        )
        < teams[2].point_percentage,
        (
            ToReal(b_team_s1_score + b_team_s2_score + teams[1].points_scored)
            / ToReal(a_team_s1_score + a_team_s2_score + teams[1].points_scored_against)
        )
        < teams[2].point_percentage,
    )
)
solver.add(And(b_team_s2_score==25,b_team_s1_score==25))
#solver.add(a_team_s1_score==14)
ma_s1 = solver.minimize(a_team_s1_score)
ma_s2 = solver.minimize(a_team_s2_score)
if solver.check() == sat:
    model = solver.model()
    print(model)
    print((model[a_team_s1_score].as_long() + model[a_team_s2_score].as_long() + teams[0].points_scored) / (model[b_team_s1_score].as_long() + model[b_team_s2_score].as_long() + teams[0].points_scored_against))
    print((model[b_team_s1_score].as_long() + model[b_team_s2_score].as_long() + teams[1].points_scored) / (model[a_team_s1_score].as_long() + model[a_team_s2_score].as_long() + teams[1].points_scored_against))