---
title: "Linear Programming: Quick Practice"
type: practice
chapter: c12.mathematics.linear-programming
order: 4
---

Try each question first, then tap **Show answer**. These are Board-style questions: JEE Main does not list this chapter. In every question $x \ge 0$ and $y \ge 0$ as well.

## Feasible points and corners

:::question{title="1. Feasible or not" exam="Board level"}
The constraints are $x + y \le 8$, $x \ge 2$, $y \ge 1$. Which of $(3, 4)$, $(1, 5)$ and $(6, 3)$ are feasible solutions?

---

$(3, 4)$: $7 \le 8$, $3 \ge 2$, $4 \ge 1$. All true.

$(1, 5)$: $x = 1 < 2$. $(6, 3)$: $x + y = 9 > 8$.

Only **$(3, 4)$** is feasible.
:::

:::question{title="2. A region away from the origin" exam="Board level"}
For the constraints in Question 1, find the maximum and minimum of $Z = 4x + y$.

---

The region is a triangle with corners $(2, 1)$, $(7, 1)$ and $(2, 6)$. It is bounded.

$Z$ at these corners: 9, 29, 14.

Maximum **29 at $(7, 1)$**; minimum **9 at $(2, 1)$**.
:::

## Bounded regions

:::question{title="3. Three constraints" exam="Board level"}
Maximise $Z = 3x + 2y$ subject to $x + 2y \le 10$, $x + y \le 6$, $x \le 4$.

---

Corners: $(0, 0)$, $(4, 0)$, $(4, 2)$, $(2, 4)$, $(0, 5)$. Here $(2, 4)$ solves $x + 2y = 10$ with $x + y = 6$. (The crossing $(4, 3)$ of $x = 4$ and $x + 2y = 10$ breaks $x + y \le 6$, so it is not a corner.)

$Z$: 0, 12, **16**, 14, 10.

Maximum **16 at $(4, 2)$**.
:::

:::question{title="4. Both optima" exam="Board level"}
Find the minimum and maximum of $Z = 5x + 4y$ subject to $x + y \ge 3$, $x \le 4$, $y \le 3$.

---

The region is bounded, with corners $(3, 0)$, $(4, 0)$, $(4, 3)$, $(0, 3)$.

$Z$: 15, 20, 32, 12.

Minimum **12 at $(0, 3)$**; maximum **32 at $(4, 3)$**.
:::

:::question{title="5. A tie" exam="Board level"}
Maximise $Z = 2x + 4y$ subject to $x + 2y \le 8$, $3x + y \le 9$.

---

Corners: $(0, 0)$, $(3, 0)$, $(2, 3)$, $(0, 4)$. $Z$: 0, 6, 16, 16.

The maximum is **16, at every point of the segment joining $(2, 3)$ and $(0, 4)$**: infinitely many optimal solutions. (Since $Z = 2(x + 2y)$, the lines $Z = k$ are parallel to the edge $x + 2y = 8$.)
:::

## Unbounded and empty regions

:::question{title="6. Minimum on an unbounded region" exam="Board level"}
Minimise $Z = 3x + 2y$ subject to $x + y \ge 4$, $x + 3y \ge 6$.

---

Unbounded region with corners $(6, 0)$, $(3, 1)$, $(0, 4)$. $Z$: 18, 11, 8. Candidate $m = 8$.

Test $3x + 2y < 8$. Every feasible point has $3x + 2y = 2(x + y) + x \ge 8$, so this half plane has no common point with the region.

Minimum **8 at $(0, 4)$**.
:::

:::question{title="7. One exists, one does not" exam="Board level"}
Find the maximum and minimum, if they exist, of $Z = 3y - x$ subject to $x \ge 1$, $y \le 4$.

---

The region is the strip $x \ge 1$, $0 \le y \le 4$: unbounded to the right. Corners $(1, 0)$ and $(1, 4)$ give $Z = -1$ and $11$.

$3y - x > 11$ needs $3y > 11 + x \ge 12$, so $y > 4$: no feasible point. So the **maximum is 11 at $(1, 4)$**.

$3y - x < -1$ holds at the feasible point $(2, 0)$. So there is **no minimum**.
:::

:::question{title="8. Any solution?" exam="Board level"}
Solve: maximise $Z = x + y$ subject to $x + 2y \le 4$, $x + y \ge 6$.

---

For $y \ge 0$: $x + y \le x + 2y \le 4$, so $x + y \ge 6$ can never hold.

**There is no feasible region**, so no feasible solution and no maximum.
:::

## Word problems

:::question{title="9. Shirts and trousers" exam="Board level"}
A tailor has 60 m of cloth and 60 hours of work. A shirt needs 2 m of cloth and 3 hours; a pair of trousers needs 3 m and 2 hours. The profit is ₹50 on a shirt and ₹60 on a pair of trousers. How many of each should be made for the most profit?

---

Let $x$ = shirts, $y$ = pairs of trousers. Maximise $Z = 50x + 60y$ subject to $2x + 3y \le 60$ (cloth), $3x + 2y \le 60$ (hours).

Corners: $(0, 0)$, $(20, 0)$, $(12, 12)$, $(0, 20)$. $Z$: 0, 1000, 1320, 1200.

**12 shirts and 12 pairs of trousers**, profit **₹1320**.
:::

:::question{title="10. Cheapest mix" exam="Board level"}
Packet P gives 3 units of vitamin A and 1 unit of vitamin B; packet Q gives 1 unit of A and 2 units of B. At least 9 units of A and 8 units of B are needed. P costs ₹20 and Q costs ₹15. Find the cheapest mix.

---

Let $x$ = packets of P, $y$ = packets of Q. Minimise $Z = 20x + 15y$ subject to $3x + y \ge 9$, $x + 2y \ge 8$.

Unbounded region with corners $(0, 9)$, $(2, 3)$, $(8, 0)$. $Z$: 135, 85, 160. Candidate $m = 85$.

Test $20x + 15y < 85$, that is $4x + 3y < 17$. But $4x + 3y = (3x + y) + (x + 2y) \ge 9 + 8 = 17$ on the region, so no common point.

**2 packets of P and 3 of Q**, least cost **₹85**.
:::
