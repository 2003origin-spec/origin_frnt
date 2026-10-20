---
title: "Linear Inequalities: Short Notes"
type: short_notes
chapter: c11.mathematics.linear-inequalities
order: 2
---

:::remember
This chapter is for **Board exams**. JEE Main does not list it in its syllabus. But the skill of solving inequalities is used everywhere in JEE: domains, ranges, quadratics, modulus and calculus.
:::

## 1. What an inequality is

- Two real numbers or two algebraic expressions joined by $<$, $>$, $\le$ or $\ge$ form an **inequality**.
- **Numerical** inequality: only numbers, like $3 < 5$. **Literal** inequality: has a variable, like $x < 5$.
- **Double** inequality: two signs at once, like $3 < x < 5$ ($x$ is greater than 3 and less than 5).
- **Strict** inequalities use $<$ or $>$. **Slack** inequalities use $\le$ or $\ge$.
- A slack inequality holds two statements: $40x + 20y \le 120$ means $40x + 20y < 120$ **or** $40x + 20y = 120$.

| Form | Name |
|---|---|
| $ax + b < 0$, $a \ne 0$ | linear, one variable |
| $ax + by \le c$, $a, b \ne 0$ | linear, two variables |
| $ax^2 + bx + c > 0$, $a \ne 0$ | quadratic, not linear |

This chapter solves **linear inequalities in one variable** only.

## 2. Solutions and the solution set

- A **solution** is a value of the variable that makes the inequality a true statement.
- The set of all solutions is the **solution set**.
- The answer depends on which numbers are allowed:

:::example{title="Same inequality, three answers"}
$30x < 200$ gives $x < \frac{20}{3}$ (about 6.67).
- $x$ natural: $\{1, 2, 3, 4, 5, 6\}$
- $x$ integer: $\{\dots, -2, -1, 0, 1, \dots, 6\}$
- $x$ real: $(-\infty, \frac{20}{3})$
:::

- If the question does not say, take $x$ **real**.
- Trying values one by one (trial and error) works but is slow. Use the rules below.

## 3. The rules for solving

- **Rule 1.** Add or subtract the same number on both sides. The sign stays.
- **Rule 2.** Multiply or divide both sides by the same **positive** number: the sign stays. By a **negative** number: the sign is **reversed**.
- These are the rules for equations, with one change: the sign flip for negatives.

:::example{title="NCERT-style solve"}
$4x + 3 < 6x + 7$

Subtract $6x$ and 3: $-2x < 4$.

Divide by $-2$ and flip: $x > -2$, so $x \in (-2, \infty)$.
:::

## 4. Steps for any linear inequality

1. Clear fractions: multiply by the LCM of the denominators (positive, so no flip).
2. Open brackets.
3. Bring the $x$ terms to one side and numbers to the other (Rule 1).
4. Divide by the coefficient of $x$ (Rule 2). Flip if it is negative.
5. Write the answer in the allowed set: a list, or an interval.

:::tip
You can keep the coefficient of $x$ positive by moving $x$ terms to the side where they stay positive. Then you never need to flip.
:::

## 5. Showing the answer on a number line

- $x < a$ or $x > a$: draw an **open circle** at $a$ and darken the line to the left (or right).
- $x \le a$ or $x \ge a$: draw a **dark (filled) circle** at $a$ and darken the line to the left (or right).
- For $2 \le x < 6$: dark circle at 2, open circle at 6, dark line between them.

## 6. Double inequalities

- Treat $c < kx + m < d$ as one chain. Do every step to **all three parts** together.
- If you multiply or divide by a negative number, flip **both** signs, then rewrite from smallest to largest.

:::example{title="A chain with a negative coefficient"}
$-5 \le \dfrac{5 - 3x}{2} \le 8$

Times 2: $-10 \le 5 - 3x \le 16$.

Minus 5: $-15 \le -3x \le 11$.

Divide by $-3$ and flip: $5 \ge x \ge -\frac{11}{3}$, that is $-\frac{11}{3} \le x \le 5$.
:::

## 7. Systems of inequalities in one variable

- A **system** is two or more inequalities that must all be true at once.
- Solve each one. The answer is the **common part** (intersection) of the solution sets.
- Draw both on one number line. The overlap is the answer.
- If there is no overlap, the system has **no solution** (empty set).

:::example{title="A system"}
$3x - 7 < 5 + x$ gives $x < 6$. $11 - 5x \le 1$ gives $x \ge 2$.

Common part: $2 \le x < 6$, that is $[2, 6)$.
:::

## 8. Word problems

Turn the words into signs:

| Words | Sign |
|---|---|
| at least, minimum, not less than | $\ge$ |
| at most, maximum, not more than | $\le$ |
| more than, greater than | $>$ |
| less than, fewer than | $<$ |
| between $a$ and $b$ | $a < x < b$ |
| between $a$ and $b$, both included | $a \le x \le b$ |

"Between" depends on the wording. With no other words, NCERT reads it as strict: "kept between 30° and 35°" is $30 < C < 35$. If the question says "including", "inclusive" or "from $a$ to $b$", include that end: NCERT's "between 2 and 6 including 2" is $2 \le x < 6$.

- **Consecutive** integers: $x, x+1$. Consecutive **odd** or **even** numbers: $x, x+2$.
- NCERT word problems in this chapter: averages of marks, consecutive numbers, sides of a triangle, cutting a board, temperature ranges, mixing acid solutions, and IQ.
- At the end, check that the answer makes sense: whole numbers for counts, positive lengths.

## 9. Removed from the current book

Older editions also had the **graphical solution of linear inequalities in two variables** (shading half-planes) and systems in two variables. The rationalised book (2023 onward, still true in the 2025-26 reprint) has dropped these sections. It still names $ax + by \le c$ as a linear inequality in two variables, but solves only one-variable inequalities. You will still shade such regions in Class 12 **Linear Programming**.
