---
title: "Linear Programming: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.linear-programming
order: 1
---

A Board exam chapter (NCERT Chapter 12). JEE Main does not list linear programming in its syllabus. NCERT solves every problem by the **graphical method** (the corner point method), with two variables $x$ and $y$.

## The problem

:::formula{title="A linear programming problem (LPP)"}
$$\text{Optimise } Z = ax + by$$
subject to linear constraints such as
$$px + qy \le r$$
(or $px + qy \ge r$, or an equation), and the non-negative restrictions $x \ge 0$, $y \ge 0$.

$Z$ = objective function ($a$, $b$ constants), $x$ and $y$ = decision variables. "Optimise" means maximise or minimise.
:::

:::formula{title="Words to inequalities"}
| Words | Sign |
|---|---|
| at most, not more than, cannot exceed | $\le$ |
| at least, not less than, minimum of | $\ge$ |
| exactly | $=$ |

Every resource (money, time, space, material) gives one constraint: amount used $\le$ amount available.
:::

## Finding corner points

:::formula{title="Where a line meets the axes"}
The line $ax + by = c$ (with $a, b, c \ne 0$) meets the x-axis at
$$\left(\frac{c}{a},\ 0\right)$$
and the y-axis at
$$\left(0,\ \frac{c}{b}\right)$$
:::

:::formula{title="Which side of the line"}
Put a test point into the inequality. If it is true there, the region is on the side of that point.

Use $(0, 0)$ unless the line passes through the origin (for example $x \le y$). Then use a point such as $(1, 0)$.
:::

:::formula{title="Corner point of two lines"}
For $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$, with $D = a_1b_2 - a_2b_1 \ne 0$:
$$x = \frac{c_1b_2 - c_2b_1}{D}$$
$$y = \frac{a_1c_2 - a_2c_1}{D}$$
This is just solving the two equations together. The point is a corner **only if it also satisfies every other constraint**.
:::

## The two theorems

:::formula{title="Theorem 1"}
If $Z = ax + by$ has an optimal value (maximum or minimum) on the feasible region $R$, that value occurs at a **corner point** of $R$.
:::

:::formula{title="Theorem 2"}
If $R$ is **bounded**, $Z$ has both a maximum and a minimum on $R$, and each occurs at a corner point.

NCERT's remark: if $R$ is unbounded, a maximum or a minimum may not exist. If it does exist, it is at a corner point (by Theorem 1).
:::

## Corner point method

:::formula{title="Steps"}
1. Find the feasible region and all its corner points.
2. Find $Z$ at each corner. Let $M$ = largest value, $m$ = smallest value.
3. **Bounded region:** $M$ is the maximum and $m$ is the minimum.
4. **Unbounded region:** use the half-plane test below.
:::

:::formula{title="Half-plane test (unbounded region only)"}
$M$ is the maximum of $Z$ if the open half plane
$$ax + by > M$$
has **no point** in common with the feasible region. Otherwise $Z$ has no maximum.

$m$ is the minimum of $Z$ if the open half plane
$$ax + by < m$$
has **no point** in common with the feasible region. Otherwise $Z$ has no minimum.
:::

:::formula{title="Multiple optimal solutions"}
If two corner points $P$ and $Q$ give the same maximum (or minimum) value, then **every point on the segment $PQ$** gives that value too. There are infinitely many optimal solutions.

Aid (beyond the book): the points of $PQ$ are $(1 - t)P + tQ$ for $0 \le t \le 1$.
:::

:::formula{title="Possible outcomes"}
| Region | Maximum | Minimum |
|---|---|---|
| Bounded | always exists | always exists |
| Unbounded | may not exist | may not exist |
| No feasible region | none | none |
:::
