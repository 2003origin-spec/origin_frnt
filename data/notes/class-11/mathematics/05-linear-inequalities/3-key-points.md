---
title: "Linear Inequalities: Important Points and Traps"
type: key_points
chapter: c11.mathematics.linear-inequalities
order: 3
---

## NCERT one-liners

:::remember
- Two real numbers or two algebraic expressions related by $<$, $>$, $\le$ or $\ge$ form an inequality.
- Equal numbers may be added to (or subtracted from) both sides without changing the sign.
- Multiplying or dividing both sides by a **negative** number **reverses** the sign.
- The values of $x$ that make an inequality true are its **solutions**.
- $<$, $>$: open circle on the number line. $\le$, $\ge$: dark circle.
- Unless stated, solve over the **real numbers**.
:::

## The sign flip

:::trap
Multiplying **or dividing** by a negative number flips the sign. Students remember it for multiplying and forget it for dividing.

$-3x > 12$ gives $x < -4$, **not** $x > -4$.
:::

:::trap
Do not multiply both sides by an expression whose sign you don't know, such as $x$ or $x - 2$, unless you split into cases (positive and negative). (Exam extra, not in NCERT.)

For $\dfrac{1}{x} < 2$, the answer is **not** just $x > \frac12$. Check both cases: $x > 0$ gives $x > \frac12$, and every $x < 0$ also works. Answer: $x < 0$ or $x > \frac12$.
:::

- Multiplying by the LCM of number denominators is safe: the LCM is positive, so no flip.
- Adding or subtracting never flips the sign, even when the number is negative.

## Which numbers are allowed

:::trap
Read the set. "$x$ is a natural number", "an integer" and "a real number" give different answers to the same inequality.

In NCERT, natural numbers start at 1. So $x < 3.5$ over natural numbers is $\{1, 2, 3\}$, not $\{0, 1, 2, 3\}$.
:::

- The solution set can be **empty**. $-5x > 12$ gives $x < -2.4$, and no natural number is that small.
- For integers, $x < -2.4$ means $x \le -3$. Do not round $-2.4$ to $-2$.

## When $x$ cancels out

:::trap
If $x$ disappears, look at what is left.
- A **true** statement means every real $x$ works. $2(x + 1) > 2x + 1$ becomes $2 > 1$: all real $x$.
- A **false** statement means no $x$ works. $2x + 3 < 2x + 1$ becomes $3 < 1$: no solution.
:::

## Double inequalities and systems

:::trap
In a chain $c < kx + m < d$, do each step to **all three** parts. When you divide by a negative number, flip **both** signs and rewrite from smallest to largest: $5 \ge x \ge -2$ is written $-2 \le x \le 5$.
:::

:::trap
A system means **AND**: take the common part (intersection), not the union. $x \ge 2$ and $x < 6$ give $[2, 6)$.

$x < 3$ and $x \ge 7$ have no common part, so the system has **no solution**.
:::

- Keep track of the end points. Each end of the final interval keeps the bracket it had in its own inequality.

## Writing the answer

:::trap
$\infty$ and $-\infty$ are not numbers. They always take a **round** bracket: $[8, \infty)$, never $[8, \infty]$.
:::

- $(a, b)$ excludes both ends, $[a, b]$ includes both, $[a, b)$ includes only $a$.
- Do not swap the sides: $x > -2$ is $(-2, \infty)$, not $(-\infty, -2)$.

## Word problems

:::trap
"At least" is $\ge$ and "at most" is $\le$. "More than" and "less than" are strict. Writing $>$ for "at least" changes the answer: in NCERT Example 7 the student needs **70** marks, not "more than 70".

"Between" depends on the wording: plain "between $a$ and $b$" is $a < x < b$ in NCERT; "between $a$ and $b$, both included" is $a \le x \le b$.
:::

- Consecutive odd (or even) numbers differ by **2**, not 1: take $x$ and $x + 2$.
- Check both conditions. "Both larger than 10" means the **smaller** number is larger than 10.
- Counts must be whole numbers and lengths positive. List only the values that fit.
- In mixture problems, adding water adds volume but **no** acid.

:::tip
Check your answer with two quick tests: put the end point in (it should give the equal case), and put in one value from inside your answer (it should give a true statement).
:::

## Exam extras (not in NCERT)

- If $a < b$ and both have the **same sign** (both positive or both negative), then $\dfrac1a > \dfrac1b$. If the signs differ, there is no flip: $-2 < 3$ and $-\frac12 < \frac13$.
- Squaring keeps the sign only when both sides are non-negative. Otherwise it can change: $-3 < 2$ but $9 > 4$.
- For $a > 0$: $|x| < a$ means $-a < x < a$, and $|x| > a$ means $x < -a$ or $x > a$.
