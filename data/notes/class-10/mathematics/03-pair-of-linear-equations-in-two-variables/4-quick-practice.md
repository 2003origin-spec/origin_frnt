---
title: "Linear Equations in Two Variables: Quick Practice"
type: practice
chapter: c10.mathematics.pair-of-linear-equations-in-two-variables
order: 4
---

Try each question first, then tap **Show answer**.

## Ratios and graphs

:::question{title="1. Type of pair" exam="Board level"}
Without solving, say whether the pair $3x - 2y + 5 = 0$ and $6x - 4y + 9 = 0$ has one solution, no solution or infinitely many solutions.

---

$\dfrac{a_1}{a_2} = \dfrac36 = \dfrac12$, $\dfrac{b_1}{b_2} = \dfrac{-2}{-4} = \dfrac12$, $\dfrac{c_1}{c_2} = \dfrac59$.

The first two are equal, the third is different. The lines are parallel: **no solution** (inconsistent).
:::

:::question{title="2. Finding k" exam="Board level"}
For what value of $k$ does the pair $kx + 2y - 4 = 0$ and $8x + ky - 8 = 0$ have infinitely many solutions?

---

All three ratios must be equal: $\dfrac{k}{8} = \dfrac{2}{k} = \dfrac{-4}{-8} = \dfrac12$.

$\dfrac{k}{8} = \dfrac12$ gives $k = 4$. Check: $\dfrac{2}{4} = \dfrac12$ too.

($k^2 = 16$ also allows $k = -4$, but then $\dfrac{k}{8} = -\dfrac12 \ne \dfrac12$: parallel lines.) So **$k = 4$**.
:::

:::question{title="3. Triangle with the x-axis" exam="Board level"}
The lines $x + y = 6$ and $x - y = 2$ and the $x$-axis form a triangle. Find its vertices and its area.

---

Adding the equations: $2x = 8$, so $x = 4$, $y = 2$. The lines meet at $(4, 2)$.

On the $x$-axis ($y = 0$): $x + y = 6$ gives $(6, 0)$, and $x - y = 2$ gives $(2, 0)$.

Base $= 6 - 2 = 4$, height $= 2$. Vertices **$(4, 2)$, $(6, 0)$, $(2, 0)$**; area $= \frac12 \times 4 \times 2 =$ **4 square units**.
:::

## Substitution

:::question{title="4. With fractions" exam="Board level"}
Solve by substitution: $\dfrac{x}{2} + \dfrac{y}{3} = 3$ and $x - y = 1$.

---

Multiply the first by 6: $3x + 2y = 18$. From the second, $x = y + 1$.

$3(y + 1) + 2y = 18$, so $5y = 15$ and $y = 3$. Then $x = 4$.

**$x = 4$, $y = 3$.**
:::

:::question{title="5. Ages" exam="Board level"}
Four years ago, a mother was 5 times as old as her son. Six years from now, she will be 3 times as old as he will be. Find their present ages.

---

Let the mother be $m$ years and the son $s$ years old now.

$m - 4 = 5(s - 4)$ gives $m = 5s - 16$. $m + 6 = 3(s + 6)$ gives $m = 3s + 12$.

So $5s - 16 = 3s + 12$, $s = 14$, $m = 54$. Check: $50 = 5 \times 10$ and $60 = 3 \times 20$.

**Mother 54 years, son 14 years.**
:::

:::question{title="6. Phone bill" exam="Board level"}
A phone plan has a fixed monthly charge plus a charge for each extra GB of data. With 5 extra GB the bill is ₹ 350. With 8 extra GB it is ₹ 440. What is the bill with 12 extra GB?

---

Fixed charge ₹ $f$, rate ₹ $r$ per GB: $f + 5r = 350$ and $f + 8r = 440$.

From the first, $f = 350 - 5r$. Then $350 + 3r = 440$, so $r = 30$ and $f = 200$.

Bill $= 200 + 12 \times 30 =$ **₹ 560**.
:::

## Elimination

:::question{title="7. Swapped coefficients" exam="Board level"}
Solve: $37x + 43y = 123$ and $43x + 37y = 117$.

---

Add: $80x + 80y = 240$, so $x + y = 3$.

Subtract the first from the second: $6x - 6y = -6$, so $x - y = -1$.

Then $2x = 2$. **$x = 1$, $y = 2$.**
:::

:::question{title="8. Digits" exam="Board level"}
The digits of a two-digit number add up to 11. Reversing the digits gives a number 27 more than the original. Find the number.

---

Tens digit $x$, units digit $y$: $x + y = 11$.

$(10y + x) - (10x + y) = 27$ gives $9y - 9x = 27$, so $y - x = 3$.

Add: $2y = 14$, $y = 7$, $x = 4$. The number is **47** (check: $74 - 47 = 27$).
:::

:::question{title="9. Tickets" exam="Board level"}
At a school fair, 300 tickets were sold for ₹ 6600. An adult ticket costs ₹ 30 and a child ticket ₹ 15. How many of each were sold?

---

Adults $a$, children $c$: $a + c = 300$ and $30a + 15c = 6600$.

Divide the second by 15: $2a + c = 440$. Subtract the first: $a = 140$. Then $c = 160$.

**140 adult and 160 child tickets.**
:::

:::question{title="10. Can it be found?" exam="Board level"}
Riya pays ₹ 85 for 2 pens and 3 notebooks. Arjun pays ₹ 170 for 4 pens and 6 notebooks. Can you find the price of one pen from this?

---

$2p + 3n = 85$ and $4p + 6n = 170$. Multiply the first by 2: $4p + 6n = 170$.

Subtracting gives $0 = 0$, a true statement with no variable. There are infinitely many solutions.

**No.** Arjun's bill is just Riya's doubled, so it gives no new information.
:::
