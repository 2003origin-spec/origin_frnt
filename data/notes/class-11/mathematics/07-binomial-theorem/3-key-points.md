---
title: "Binomial Theorem: Important Points and Traps"
type: key_points
chapter: c11.mathematics.binomial-theorem
order: 3
---

## What is in NCERT now

:::remember
- NCERT covers the binomial theorem for a **positive integer** index only, with Pascal's triangle and the proof by induction.
- The **general term, middle term and term independent of $x$** were removed from the rationalised book. They are still in the JEE Main syllabus ("general term and middle term"), so these notes keep them, labelled "exam extra".
- Pascal's triangle is also called **Meru Prastara**, given by **Pingla**.
:::

## The shape of an expansion

:::remember
- $(a + b)^n$ has $n + 1$ terms.
- In every term the powers of $a$ and $b$ add up to $n$.
- ${}^nC_0 + {}^nC_1 + \cdots + {}^nC_n = 2^n$.
- ${}^nC_0 - {}^nC_1 + {}^nC_2 - \cdots + (-1)^n\,{}^nC_n = 0$ for $n \ge 1$.
:::

:::trap
The minus sign belongs to the second term. In $(x - y)^n$, the term with $y^k$ has the sign $(-1)^k$. So odd powers of $y$ get a minus sign, even powers get a plus sign.

In $(2x - 3)^5$, the term with $x^2$ has $(-3)^3 = -27$ in it, so it is **negative**.
:::

:::trap
**Binomial coefficient is not the same as the coefficient.** In $(2x + 3y)^5$, the binomial coefficient of the $x^3y^2$ term is ${}^5C_2 = 10$, but the coefficient of $x^3y^2$ is $10 \times 2^3 \times 3^2 = 720$. Read the question carefully.
:::

:::trap
${}^nC_1 + {}^nC_2 + \cdots + {}^nC_n = 2^n - 1$, not $2^n$. The sum $2^n$ includes ${}^nC_0 = 1$.
:::

## General term (exam extra)

:::trap
$T_{r+1} = {}^nC_r\, a^{n-r} b^r$ is the **$(r+1)$th** term. The 5th term uses $r = 4$, not $r = 5$.
:::

:::trap
The $r$th term **from the end** of $(a + b)^n$ is the $(n - r + 2)$th term from the start. Or swap the roles of $a$ and $b$ and count from the front, as the $r$th term of $(b + a)^n$.
:::

:::trap
When you solve for $r$ to find a coefficient or the constant term, $r$ must be a **whole number from $0$ to $n$**. If you get $r = \tfrac73$ or $r = 9$ in a 6th power, that term does not exist and the answer is **0**.
:::

- Collect **all** the powers of $x$ before you solve. In $\left(x^2 - \dfrac2x\right)^9$, $T_{r+1}$ has $x^{2(9-r)} \cdot x^{-r} = x^{18 - 3r}$.
- Keep the sign and the numbers: $\left(-\dfrac{2}{x}\right)^r = (-2)^r x^{-r}$.

## Middle terms (exam extra)

- $n$ even: one middle term, $T_{\frac n2 + 1}$. For $n = 8$ it is $T_5$.
- $n$ odd: two middle terms, $T_{\frac{n+1}{2}}$ and $T_{\frac{n+3}{2}}$. For $n = 7$ they are $T_4$ and $T_5$.
- The largest **binomial coefficient** sits in the middle. But the largest **coefficient** need not: in $(1 + 2x)^n$ the powers of 2 push it to the right.

## Applications

:::tip
**Remainders:** write the base as (a multiple of the divisor) $\pm 1$.
- $7^{2n} = 49^n = (1 + 48)^n$, so $7^{2n}$ leaves remainder 1 on division by 48.
- $2^{3n} = 8^n = (7 + 1)^n$, so $8^n$ leaves remainder 1 on division by 7.
:::

:::trap
A remainder must be from $0$ to (divisor − 1). If the work gives $-1$, add the divisor: remainder $-1$ on division by 9 means remainder $8$.
:::

- NCERT results of this kind: $6^n - 5n$ leaves remainder 1 when divided by 25; $9^{n+1} - 8n - 9$ is divisible by 64.
- To compare a big power with a number, keep the first two or three terms. This works only when all the dropped terms are **positive** (for example $(1 + x)^n$ with $x > 0$).

:::tip
For $(\sqrt3 + \sqrt2)^n \pm (\sqrt3 - \sqrt2)^n$, use the sum and difference results. Half the terms cancel and the answer is often a whole number (or a whole number times a root).
:::

## Quick recall

:::tip
- Row 5 of Pascal's triangle: 1, 5, 10, 10, 5, 1. Row 6: 1, 6, 15, 20, 15, 6, 1.
- Row $n$ adds up to $2^n$: row 5 gives 32, row 6 gives 64. Use this to check a row.
- $(1+x)^n$ at $x = 1$ gives the sum of the coefficients; at $x = -1$ it gives the alternating sum.
- (Exam extra) The number of terms in $(a + b + c)^n$ is ${}^{n+2}C_2$.
:::
