---
title: "Linear Programming: Short Notes"
type: short_notes
chapter: c12.mathematics.linear-programming
order: 2
---

This chapter is for **Board exams**. JEE Main does not list it in its syllabus. It needs the graph of a linear inequality in two variables: draw the line, then shade the side that a test point satisfies (see the Formula Sheet). The Class 12 book says this was done in Class 11, but the current Class 11 book has dropped that part, so practise it with the test-point rule.

These notes have no graphs, so each feasible region is described by its **corner points**, listed in order around the boundary. In a Board answer, always draw the shaded graph yourself.

## 1. What an LPP is

- An **optimisation problem** looks for the largest profit, the smallest cost, or the least use of resources.
- A **linear programming problem (LPP)** finds the maximum or minimum of a **linear** function of the variables, when the variables are non-negative and satisfy a set of **linear inequalities**.
- "Linear": every relation is linear (no $x^2$, no $xy$). "Programming": finding a plan of action.

| Term | Meaning |
|---|---|
| Objective function | $Z = ax + by$, to be maximised or minimised |
| Decision variables | $x$ and $y$ |
| Constraints | the linear inequalities (or equations) on $x$, $y$ |
| Non-negative restrictions | $x \ge 0$, $y \ge 0$ |

## 2. Writing a word problem as an LPP

1. Say clearly what $x$ and $y$ stand for (with units).
2. Write one constraint for each limit: money, space, time, material.
3. Add $x \ge 0$, $y \ge 0$.
4. Write $Z$ and say whether to maximise or minimise it.

:::example{title="NCERT's furniture dealer"}
Tables cost ₹2500 and chairs ₹500. The dealer has ₹50,000 and space for at most 60 pieces. Profit is ₹250 per table and ₹75 per chair.

Let $x$ = tables, $y$ = chairs. Maximise $Z = 250x + 75y$ subject to:
$$2500x + 500y \le 50000$$
that is,
$$5x + y \le 100$$
$$x + y \le 60$$
and $x \ge 0$, $y \ge 0$.
:::

## 3. Feasible region and solutions

- **Feasible region** (solution region): the region common to **all** the constraints, including $x, y \ge 0$. The rest of the plane is the **infeasible region**.
- **Feasible solution**: any point inside or on the boundary of the feasible region. A point outside it is an **infeasible solution**.
- **Optimal (feasible) solution**: a feasible point that gives the maximum or minimum value of $Z$.
- The feasible region of an LPP is always a **convex** region.

:::remember
A region is **bounded** if it can be enclosed within a circle. Otherwise it is **unbounded**: it goes on for ever in some direction.
:::

## 4. Corner points

- A **corner point** (vertex) is a point of the feasible region where two boundary lines meet.
- To find them: draw each line using its intercepts (or any two points, if it passes through the origin), shade the correct side, then solve the equations of the two lines meeting at each corner.
- An intersection point that breaks any other constraint is **not** a corner of the region.

In the dealer problem the region is the quadrilateral with corners O(0, 0), A(20, 0), B(10, 50), C(0, 60). B comes from solving $5x + y = 100$ and $x + y = 60$.

## 5. Why only the corners?

- **Theorem 1:** if $Z$ has an optimal value, it occurs at a corner point of the feasible region.
- **Theorem 2:** if the region is bounded, $Z$ has both a maximum and a minimum, each at a corner point.
- NCERT states these theorems without proof (the proofs are beyond the book).

So we only need $Z$ at a few points, not at the infinitely many points of the region.

## 6. Corner point method: a bounded region

Evaluate $Z$ at every corner, then pick the largest and smallest values.

| Corner | $Z = 250x + 75y$ |
|---|---|
| (0, 0) | 0 |
| (20, 0) | 5000 |
| (10, 50) | **6250** (max) |
| (0, 60) | 4500 |

The dealer earns the most, ₹6250, by buying **10 tables and 50 chairs**.

## 7. Unbounded regions

- On an unbounded region the largest or smallest corner value is only a **candidate**.
- Check it with the **open half plane**. For a candidate minimum $m$, draw $ax + by < m$. If this half plane shares **no** point with the region, $m$ is the minimum. If it shares any point, there is no minimum.
- For a candidate maximum $M$, do the same with $ax + by > M$.

:::example{title="Unbounded region"}
Minimise $Z = 2x + 3y$ subject to $2x + y \ge 4$, $x + 2y \ge 5$, $x, y \ge 0$.

The region is unbounded, with corners $(0, 4)$, $(1, 2)$, $(5, 0)$. $Z$ there is 12, **8**, 10, so the candidate is $m = 8$.

The half plane $2x + 3y < 8$ lies below the line through $(4, 0)$ and $\left(0, \tfrac83\right)$. It has no point in common with the region, so the minimum is **8 at (1, 2)**. $Z$ has no maximum: it grows without limit as $x$ grows.
:::

## 8. Special cases

- **Multiple optimal solutions:** if two corners give the same best value, every point on the segment joining them does too. In NCERT's Example 3, $Z = 3x + 9y$ is 180 at both $(15, 15)$ and $(0, 20)$.
- **No feasible region:** if the constraints have no common point, there is **no feasible solution**, so no maximum or minimum. Example: $x + y \ge 8$ and $3x + 5y \le 15$ with $x, y \ge 0$.

:::tip
NCERT's examples and exercises have one to three constraints besides $x, y \ge 0$, so the graph stays simple. In a Board answer, show four things: the variables, the constraints, the shaded graph, and the table of $Z$ at the corners.
:::
