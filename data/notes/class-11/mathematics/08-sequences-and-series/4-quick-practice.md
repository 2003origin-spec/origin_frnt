---
title: "Sequences and Series: Quick Practice"
type: practice
chapter: c11.mathematics.sequences-and-series
order: 4
---

Try each question first, then tap **Show answer**.

## Arithmetic progressions

:::question{title="1. A term" exam="Warm-up"}
Find the 16th term of the AP $2, 5, 8, \dots$

---

$a = 2$, $d = 3$: $a_{16} = 2 + 15 \times 3 =$ **47**.
:::

:::question{title="2. A sum" exam="Warm-up"}
Find the sum of the first 20 terms of the AP $1, 4, 7, \dots$

---

$S_{20} = \dfrac{20}{2}\left[2(1) + 19(3)\right] = 10 \times 59 =$ **590**.
:::

:::question{title="3. Term from the sum" exam="JEE Main level"}
The sum of the first $n$ terms of a sequence is $S_n = 3n^2 + 5n$. Find $a_n$. Is it an AP?

---

$a_n = S_n - S_{n-1} = (3n^2 + 5n) - \left[3(n-1)^2 + 5(n-1)\right] =$ **$6n + 2$**.

Check: $a_1 = S_1 = 8 = 6(1) + 2$. So the formula holds from the first term, and it is an AP with $d = 6$.
:::

:::question{title="4. Two answers" exam="JEE Main level"}
How many terms of the AP $20, 18, 16, \dots$ add up to 108?

---

$S_n = \dfrac{n}{2}\left[40 - 2(n - 1)\right] = n(21 - n) = 108$, so $n^2 - 21n + 108 = 0$ and $(n - 9)(n - 12) = 0$.

**9 or 12 terms.** Both work: the 10th, 11th and 12th terms are 2, 0 and −2, which add up to zero.
:::

## Geometric progressions

:::question{title="5. Finding a term" exam="Boards level"}
The 2nd term of a GP is 6 and the 5th term is 48. Find the 6th term.

---

$ar = 6$ and $ar^4 = 48$. Dividing, $r^3 = 8$, so $r = 2$ and $a = 3$. Then $a_6 = 3 \times 2^5 =$ **96**.
:::

:::question{title="6. Inserting means" exam="Boards level"}
Insert three numbers between 1 and 256 so that all five numbers form a GP.

---

$256 = 1 \times r^4$, so $r = 4$ or $r = -4$.

With $r = 4$: **4, 16, 64**. With $r = -4$: **−4, 16, −64**. Both answers are correct.
:::

:::question{title="7. Repeated digits" exam="JEE Main level"}
Find the sum of the first $n$ terms of $0.3 + 0.33 + 0.333 + \cdots$

---

Each term is $\tfrac39$ times $0.9, 0.99, 0.999, \dots$, so the $k$th term is $\tfrac13(1 - 10^{-k})$.

$S_n = \dfrac13\left[n - \left(\dfrac{1}{10} + \dfrac{1}{10^2} + \cdots + \dfrac{1}{10^n}\right)\right] = \dfrac13\left[n - \dfrac{1 - 10^{-n}}{9}\right]$

So $S_n =$ **$\dfrac{1}{27}\left(9n - 1 + 10^{-n}\right)$**.
:::

## Means and sums

:::question{title="8. From AM and GM" exam="Boards level"}
The AM of two positive numbers is 10 and their GM is 8. Find the numbers.

---

They are the roots of $x^2 - 2(10)x + 8^2 = 0$, that is $x^2 - 20x + 64 = 0$, so $(x - 16)(x - 4) = 0$.

The numbers are **16 and 4**.
:::

:::question{title="9. Minimum value" exam="JEE Main level"}
Find the least value of $4x + \dfrac{9}{x}$ for $x > 0$.

---

By AM ≥ GM: $\dfrac{4x + \frac9x}{2} \ge \sqrt{4x \cdot \frac9x} = 6$, so $4x + \dfrac9x \ge$ **12**.

Equality needs $4x = \dfrac9x$, that is $x = \dfrac32$.
:::

:::question{title="10. Sum of squares" exam="JEE Main level"}
Find $1^2 + 2^2 + 3^2 + \cdots + 10^2$.

---

$\dfrac{n(n+1)(2n+1)}{6}$ with $n = 10$: $\dfrac{10 \times 11 \times 21}{6} =$ **385**.
:::
