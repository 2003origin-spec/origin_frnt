---
title: "Linear Programming: Important Points and Traps"
type: key_points
chapter: c12.mathematics.linear-programming
order: 3
---

A Board exam chapter. JEE Main does not list it in its syllabus.

## NCERT one-liners

:::remember
- An LPP finds the optimal (maximum or minimum) value of a **linear** objective function, subject to **linear** constraints and non-negative variables.
- The feasible region is the region common to **all** constraints, **including** $x \ge 0$ and $y \ge 0$.
- Points **inside and on the boundary** of the feasible region are feasible solutions.
- The feasible region is always **convex**.
- If an optimal value exists, it occurs at a **corner point** (Theorem 1).
- On a **bounded** region, $Z$ always has both a maximum and a minimum (Theorem 2).
- A region is bounded if it can be enclosed within a circle.
- NCERT uses only the **graphical method** (the corner point method).
:::

## Setting up the problem

:::trap
**Do not forget $x \ge 0$ and $y \ge 0$.** Without them, the "feasible region" runs into the other quadrants and you get wrong corners.
:::

:::trap
Read the words carefully. "At least 8" is $\ge 8$; "at most 8" and "not more than 8" are $\le 8$. Swapping them flips the shaded side and changes every answer.
:::

- Make units match before writing a constraint: hours with hours, rupees with rupees.
- Divide a constraint by a common factor to keep numbers small: $2500x + 500y \le 50000$ becomes $5x + y \le 100$.

## Finding corner points

:::trap
**Test point $(0, 0)$ fails when the line passes through the origin.** For $x \le y$, put in $(1, 0)$: $1 \le 0$ is false, so shade the side **away** from $(1, 0)$, where $y \ge x$.
:::

:::trap
**Not every crossing is a corner.** Two boundary lines may meet at a point that breaks a third constraint. Check each crossing in all the constraints before putting it in your table.
:::

- A corner can lie on an axis: where a line meets $x = 0$ or $y = 0$.
- The origin is a corner only if it satisfies every constraint. With a "$\ge$" constraint that has a positive right side, such as $x + y \ge 3$, it never does: at the origin the left side is 0, and $0 \ge 3$ is false.

## Bounded vs unbounded

:::trap
**On an unbounded region, the best corner value is only a candidate.** Always do the half-plane test.

Example: on the unbounded region with corners $(0, 4)$, $(1, 2)$, $(5, 0)$ (from $2x + y \ge 4$, $x + 2y \ge 5$), $Z = x - y$ is $-4$, $-1$, $5$. Yet $Z$ has **no minimum and no maximum**: along the y-axis $Z = -y$ falls without limit, and along the x-axis $Z = x$ grows without limit.
:::

:::trap
The half plane in the test is **open**: $ax + by > M$ or $ax + by < m$, with a strict sign. Points on the line $ax + by = M$ itself do not count.
:::

:::tip
Quick check (beyond the book) for a region in the first quadrant with $a > 0$ and $b > 0$:
- if there is a feasible region, the **minimum** of $Z = ax + by$ always exists, even if the region is unbounded;
- if the region is unbounded, the **maximum** never exists.

Use this to predict the answer, but still write the half-plane test in a Board answer.
:::

## Special cases

:::trap
**A tie at two corners means infinitely many optimal solutions.** If $Z$ is best at both $P$ and $Q$, every point on segment $PQ$ is optimal. Do not write "the optimal point is $P$" alone.

For $Z = x + y$ on $x + y \le 6$, $x \le 4$, $x, y \ge 0$: the maximum 6 occurs at $(0, 6)$, at $(4, 2)$ and at every point between them.
:::

- A tie for the **best** value can only happen when the lines $Z = k$ are **parallel** to an edge of the region (the edge joining the two tied corners). Two corners can also share a value that is not the best: that is not a multiple-optimum case.
- If the constraints have no common point, write: **no feasible region, so no feasible solution**. There is no maximum or minimum.

:::trap
"Unbounded region" and "no feasible region" are different. An unbounded region has infinitely many feasible points; an empty one has none.
:::

## Writing the answer

:::tip
A full Board answer has five parts:
1. variables defined, with units;
2. the LPP: $Z$ and all constraints;
3. the graph, shaded, with corners labelled;
4. a table of $Z$ at every corner;
5. the conclusion in words (for example, "10 tables and 50 chairs, profit ₹6250").
:::

- Arrange the corners in order around the region. Then a missed corner is easy to spot.
