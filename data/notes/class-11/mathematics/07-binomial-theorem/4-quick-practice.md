---
title: "Binomial Theorem: Quick Practice"
type: practice
chapter: c11.mathematics.binomial-theorem
order: 4
---

Try each question first, then tap **Show answer**. Questions 1–4 use the general term, and 5 a coefficient sum (exam extra: in the JEE Main syllabus, not in NCERT).

## Terms and coefficients

:::question{title="1. A coefficient" exam="JEE Main level"}
Find the coefficient of $x^3$ in the expansion of $(1 - 2x)^6$.

---

$T_{r+1} = {}^6C_r\,(-2x)^r$. For $x^3$, take $r = 3$: ${}^6C_3\,(-2)^3 = 20 \times (-8) =$ **−160**.
:::

:::question{title="2. Middle term" exam="JEE Main level"}
Find the middle term of $\left(2x - \dfrac{1}{x}\right)^8$.

---

$n = 8$ is even, so there is one middle term, $T_5$ ($r = 4$):

$T_5 = {}^8C_4\,(2x)^4\left(-\dfrac1x\right)^4 = 70 \times 16 =$ **1120**.
:::

:::question{title="3. Constant term" exam="JEE Main level"}
Find the term independent of $x$ in $\left(x^2 - \dfrac{2}{x}\right)^9$.

---

$T_{r+1} = {}^9C_r\,(x^2)^{9-r}\left(-\dfrac2x\right)^r = {}^9C_r\,(-2)^r\,x^{18 - 3r}$.

$18 - 3r = 0$ gives $r = 6$, the 7th term: ${}^9C_6 \times (-2)^6 = 84 \times 64 =$ **5376**.
:::

:::question{title="4. A missing power" exam="JEE Main level"}
Find the coefficient of $x^4$ in $\left(x^3 + \dfrac{1}{x^2}\right)^7$.

---

$T_{r+1} = {}^7C_r\,x^{3(7-r)}\,x^{-2r} = {}^7C_r\,x^{21 - 5r}$.

$21 - 5r = 4$ gives $r = \dfrac{17}{5}$, which is not a whole number. No term has $x^4$, so the coefficient is **0**.
:::

## Sums of coefficients

:::question{title="5. Sum of all coefficients" exam="JEE Main level"}
Find the sum of all the coefficients in the expansion of $(x^2 - 3x + 1)^{11}$.

---

Put $x = 1$: $(1 - 3 + 1)^{11} = (-1)^{11} =$ **−1**.
:::

:::question{title="6. Finding n" exam="JEE Main level"}
If ${}^nC_1 + {}^nC_2 + \cdots + {}^nC_n = 255$, find $n$.

---

The full sum from ${}^nC_0$ is $2^n$, so $2^n - 1 = 255$. Then $2^n = 256$ and $n =$ **8**.
:::

## Applications

:::question{title="7. A remainder" exam="JEE Main level"}
Find the remainder when $2^{100}$ is divided by 7.

---

$2^{100} = 2 \times 2^{99} = 2 \times 8^{33} = 2\,(1 + 7)^{33}$.

$(1 + 7)^{33} = 1 + 7m$ for some whole number $m$, so $2^{100} = 2 + 14m$. The remainder is **2**.
:::

:::question{title="8. Largest divisor" exam="JEE Main level"}
Find the largest whole number $k$ that divides $25^n - 24n - 1$ for every positive integer $n$.

---

$25^n = (1 + 24)^n = 1 + 24n + {}^nC_2\,24^2 + {}^nC_3\,24^3 + \cdots$

So $25^n - 24n - 1 = 24^2\left({}^nC_2 + {}^nC_3 \cdot 24 + \cdots\right)$, which is always a multiple of $576$.

At $n = 2$ the value is $625 - 48 - 1 = 576$ itself, so no larger number works. $k =$ **576**.
:::

:::question{title="9. Approximation" exam="JEE Main level"}
Using the first three terms of the binomial expansion, find an approximate value of $(1.02)^6$.

---

$(1 + 0.02)^6 \approx 1 + 6(0.02) + 15(0.02)^2 = 1 + 0.12 + 0.006 =$ **1.126**.
:::

:::question{title="10. Sum of two expansions" exam="JEE Main level"}
Find the value of $(\sqrt3 + 1)^4 + (\sqrt3 - 1)^4$.

---

The terms with odd powers of the second term ($x^3$ and $x$) cancel:
$$(x + 1)^4 + (x - 1)^4 = 2\left(x^4 + 6x^2 + 1\right)$$

With $x = \sqrt3$: $2\,(9 + 18 + 1) =$ **56**.
:::
