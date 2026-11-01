---
title: "Sequences and Series: Short Notes"
type: short_notes
chapter: c11.mathematics.sequences-and-series
order: 2
---

## 1. Sequences

- A **sequence** is a list of numbers in a definite order: $a_1, a_2, a_3, \dots$. The $n$th term $a_n$ is also called the general term.
- **Finite** sequences stop; **infinite** ones go on for ever.
- A sequence can be given by a formula for $a_n$ (such as $a_n = n^2$) or by a rule linking each term to earlier ones.

:::example{title="Fibonacci sequence"}
$a_1 = a_2 = 1$ and $a_n = a_{n-1} + a_{n-2}$ for $n \ge 3$ give $1, 1, 2, 3, 5, 8, 13, \dots$
:::

## 2. Series

- A **series** is what you get by adding the terms of a sequence: $a_1 + a_2 + a_3 + \cdots$. An infinite series need not add up to a finite number.
- It is written with sigma: $\displaystyle\sum_{k=1}^{n} a_k$.
- The sum of the first $n$ terms is $S_n$. Each term can be recovered as $a_n = S_n - S_{n-1}$ for $n \ge 2$, with $a_1 = S_1$.

## 3. Arithmetic progression (Class 10 recap)

- Each term is the previous one **plus a fixed number** $d$ (the common difference). $d$ can be positive, negative or zero.
- $a_n = a + (n-1)d$ has the form $pn + q$ (linear in $n$, or just a constant if $d = 0$). The sum $S_n$ has the form $Pn^2 + Qn$, with **no constant term**.
- Adding, subtracting, multiplying or dividing every term by the same non-zero number gives another AP.
- The sum of two terms equally far from the two ends is always the same: $a_1 + a_n = a_2 + a_{n-1} = \cdots$

:::tip
Choose terms that cancel: three numbers in AP as $a - d,\ a,\ a + d$ (their sum is $3a$). Four numbers as $a - 3d,\ a - d,\ a + d,\ a + 3d$ (common difference $2d$).
:::

## 4. Arithmetic mean

- The **AM** of $a$ and $b$ is $\dfrac{a + b}{2}$. It is the middle number that makes $a, A, b$ an AP.
- To insert $n$ numbers between $a$ and $b$ so that $a, A_1, \dots, A_n, b$ together form an AP, use $d = \dfrac{b - a}{n + 1}$.

## 5. Geometric progression

- Each term is the previous one **times a fixed number** $r$ (the common ratio). $r$ can be negative, but no term and no ratio can be zero.
- If $r < 0$, the terms alternate in sign.
- Multiplying every term by the same non-zero number gives another GP. So do the reciprocals of the terms, and their squares.
- If all the terms are positive, their logarithms are in AP.

:::tip
Three numbers in GP: $\dfrac{a}{r},\ a,\ ar$. Their product is $a^3$, which often gives $a$ at once.
:::

## 6. Sum of a GP

- $S_n = \dfrac{a(r^n - 1)}{r - 1}$ for $r \ne 1$. If $r = 1$, every term is $a$, so $S_n = na$.
- Use the $\dfrac{a(1 - r^n)}{1 - r}$ form when $|r| < 1$: then $1 - r^n$ and $1 - r$ are both positive.
- **Infinite GP:** when $|r| < 1$, $r^n$ shrinks to 0, so the sum settles at $\dfrac{a}{1 - r}$.

:::example{title="A recurring decimal"}
$0.\overline{3} = 0.3 + 0.03 + 0.003 + \cdots = \dfrac{0.3}{1 - 0.1} = \dfrac13$
:::

## 7. Geometric mean

- The **GM** of two positive numbers $a$ and $b$ is $\sqrt{ab}$, the positive number $G$ that makes $a, G, b$ a GP.
- To insert $n$ GMs between two positive numbers $a$ and $b$, use $r = (b/a)^{1/(n+1)}$.

## 8. AM and GM together

- For positive numbers, **AM ≥ GM**, with equality only when the numbers are equal.
- For positive terms with a fixed product, this gives the smallest value of their sum, **if the terms can actually be equal**. (For $x \ge 2$, $x + \frac1x \ge 2$ is never reached; the least value is $2.5$, at $x = 2$.)

:::example{title="Smallest value"}
For $x > 0$: $\dfrac{x + \frac1x}{2} \ge \sqrt{x \cdot \tfrac1x} = 1$, so $x + \dfrac1x \ge 2$, and the minimum 2 comes at $x = 1$.
:::

- If you know the AM ($A$) and GM ($G$) of two positive numbers, the numbers are the roots of $x^2 - 2Ax + G^2 = 0$.

## 9. Sums of natural numbers (exam extra)

- $1 + 2 + \cdots + n = \dfrac{n(n+1)}{2}$
- $1^2 + 2^2 + \cdots + n^2 = \dfrac{n(n+1)(2n+1)}{6}$
- $1^3 + 2^3 + \cdots + n^3 = \left[\dfrac{n(n+1)}{2}\right]^2$, the square of the first sum.
- To sum a series whose $n$th term is a polynomial, write $a_n$ in powers of $n$ and add each part with these results.

:::example{title="Sum of n(n+1)"}
$\displaystyle\sum_{k=1}^{n} k(k+1) = \sum k^2 + \sum k = \frac{n(n+1)(2n+1)}{6} + \frac{n(n+1)}{2} = \frac{n(n+1)(n+2)}{3}$
:::
