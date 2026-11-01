---
title: "Linear Equations in Two Variables: Important Points and Traps"
type: key_points
chapter: c10.mathematics.pair-of-linear-equations-in-two-variables
order: 3
---

## Words to know

:::remember
- **Consistent**: has at least one solution (one, or infinitely many).
- **Inconsistent**: has no solution. The lines are parallel.
- **Dependent**: the two equations are really the same line. A dependent pair is always consistent.
:::

:::trap
"Consistent" does **not** mean "exactly one solution". Coincident lines are consistent too. If a question asks "Is the pair consistent?", the answer is yes for both intersecting and coincident lines.
:::

## Comparing ratios

:::trap
Write **both** equations in the same form before comparing. Take $2x + 3y = 8$ and $4x + 6y - 16 = 0$. Reading $c_1 = 8$ and $c_2 = -16$ gives $\dfrac{c_1}{c_2} = -\dfrac12$, which is wrong. Write the first as $2x + 3y - 8 = 0$. Now all three ratios are $\dfrac12$: coincident lines. Make both "$\ldots = 0$", or both "$\ldots = c$".
:::

:::trap
For **no solution**, two things must be true: $\dfrac{a_1}{a_2} = \dfrac{b_1}{b_2}$ **and** $\dfrac{b_1}{b_2} \ne \dfrac{c_1}{c_2}$. If you only use the first, you may pick a value of $k$ that actually gives coincident lines.
:::

:::trap
For **infinitely many** solutions, all three ratios must be equal. When $k^2 = 16$, test **both** $k = 4$ and $k = -4$ in all three ratios. Often only one of them works.
:::

- "Unique solution" needs only $\dfrac{a_1}{a_2} \ne \dfrac{b_1}{b_2}$. The $c$ ratio does not matter here.
- "At least one solution" (consistent) means intersecting **or** coincident.

:::tip
Quick test for one solution: if $\dfrac{a_1}{a_2} \ne \dfrac{b_1}{b_2}$, stop. The lines cross and there is exactly one answer.
:::

## Graphs

- Two points fix a line. A third point is a good check that you made no mistake.
- To find where a line meets the $x$-axis, put $y = 0$. For the $y$-axis, put $x = 0$.
- A triangle "formed by two lines and the $x$-axis" has three corners: the point where the lines meet, and the point where each line meets the $x$-axis.

:::trap
Graph reading is only exact for neat points like $(6, 0)$. If the answer has fractions, you cannot read it well from a graph. Check it algebraically.
:::

## Substitution and elimination

:::remember
- No variable left and a **true** statement ($0 = 0$, $18 = 18$): infinitely many solutions.
- No variable left and a **false** statement ($0 = 9$): no solution.
:::

:::trap
When you multiply an equation, multiply **every** term, including the constant on the right. $2(x + 3y) = 8$ is wrong for "multiply $x + 3y = 8$ by 2". It must be $2x + 6y = 16$.
:::

:::trap
When subtracting, change the sign of **every** term of the second equation. $(4x + 6y) - (4x - 2y)$ is $8y$, not $4y$.
:::

- In elimination, put the value you found into an **original** equation, not one you multiplied. A slip in the multiplied equation would carry through. (In substitution, the book puts it into the expression from Step 1. That is fine too.)
- Always **verify**: put both values into both original equations.

:::tip
Swapped coefficients, like $37x + 43y = 123$ and $43x + 37y = 117$: **add** the equations to get $x + y$, and **subtract** to get $x - y$. Then solve these two easy ones.
:::

:::tip
Clear decimals and fractions first. Multiply $0.2x + 0.3y = 1.3$ by 10. Multiply $\dfrac{x}{2} + \dfrac{y}{3} = 3$ by 6 (the LCM).
:::

## Word problems

:::trap
Ages: "5 years ago" changes **both** people's ages by 5. Write $(x - 5)$ and $(y - 5)$, not just one of them.
:::

:::trap
Digits: the number with tens digit $x$ and units digit $y$ is $10x + y$, **not** $xy$. When the question says "the digits differ by 2", solve both $x - y = 2$ and $y - x = 2$.
:::

- Answers that count things must be whole numbers, 0 or more. If you get $2.5$ notes or $-3$ people, look for a mistake.
- Say what $x$ and $y$ stand for, with units, at the start. End with a sentence that answers the question asked.
