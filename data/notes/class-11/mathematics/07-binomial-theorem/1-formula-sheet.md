---
title: "Binomial Theorem: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.binomial-theorem
order: 1
---

NCERT (and JEE Main) use the binomial theorem for a **positive integer** index $n$ only. Everything below assumes that.

## Binomial coefficients

:::formula{title="Binomial coefficient"}
$${}^nC_r = \frac{n!}{r!\,(n-r)!}$$
$n$ = a non-negative integer, $r$ = a whole number with $0 \le r \le n$.
$${}^nC_0 = {}^nC_n = 1$$
:::

:::formula{title="Pascal's rule"}
$${}^nC_r + {}^nC_{r-1} = {}^{n+1}C_r$$
For $1 \le r \le n$. This is how each row of Pascal's triangle is built from the row above. NCERT uses it in the induction proof.
:::

:::formula{title="Symmetry"}
$${}^nC_r = {}^nC_{n-r}$$
So coefficients equally far from the two ends of an expansion are equal.
:::

## The theorem

:::formula{title="Binomial theorem"}
$$(a+b)^n = \sum_{k=0}^{n} {}^nC_k\, a^{n-k}\, b^k$$
Written out:
$$\begin{aligned} (a+b)^n &= {}^nC_0\, a^n + {}^nC_1\, a^{n-1} b \\ &\quad + {}^nC_2\, a^{n-2} b^2 + \cdots + {}^nC_n\, b^n \end{aligned}$$
$n$ = a positive integer. There are $n + 1$ terms, and in every term the powers of $a$ and $b$ add up to $n$.
:::

:::formula{title="With a minus sign"}
$$(x-y)^n = \sum_{k=0}^{n} (-1)^k\, {}^nC_k\, x^{n-k} y^k$$
The signs alternate $+, -, +, \dots$; the last term is $(-1)^n\, y^n$.
:::

:::formula{title="Powers of 1 + x"}
$$(1+x)^n = \sum_{k=0}^{n} {}^nC_k\, x^k$$
$$(1-x)^n = \sum_{k=0}^{n} (-1)^k\, {}^nC_k\, x^k$$
:::

## Sums of binomial coefficients

The first three are in NCERT (special cases of $(1 \pm x)^n$).

:::formula{title="All coefficients (put x = 1)"}
$${}^nC_0 + {}^nC_1 + \cdots + {}^nC_n = 2^n$$
:::

:::formula{title="Alternating sum (put x = 1 in (1 − x)ⁿ)"}
$${}^nC_0 - {}^nC_1 + {}^nC_2 - \cdots + (-1)^n\, {}^nC_n = 0$$
For $n \ge 1$.
:::

:::formula{title="Other values of x (NCERT Exercise 7.1)"}
Put $x = 3$ in $(1 + x)^n$:
$$\sum_{r=0}^{n} 3^r\, {}^nC_r = 4^n$$
:::

:::formula{title="Odd and even places (exam extra)"}
$${}^nC_0 + {}^nC_2 + {}^nC_4 + \cdots = 2^{n-1}$$
$${}^nC_1 + {}^nC_3 + {}^nC_5 + \cdots = 2^{n-1}$$
For $n \ge 1$. Add and subtract the first two results of this section.
:::

:::formula{title="Sum of the coefficients of any expansion (exam extra)"}
Put every variable equal to 1. For example, the coefficients of $(2x - 3y)^5$ add up to
$$(2 - 3)^5 = -1$$
:::

## Sum and difference of two expansions

From NCERT Exercise 7.1 (Q11, Q12):

:::formula{title="Sum keeps the even powers of b"}
$$\begin{aligned} (a+b)^n &+ (a-b)^n \\ &= 2\big[{}^nC_0\, a^n \\ &\quad + {}^nC_2\, a^{n-2} b^2 + \cdots\big] \end{aligned}$$
:::

:::formula{title="Difference keeps the odd powers of b"}
$$\begin{aligned} (a+b)^n &- (a-b)^n \\ &= 2\big[{}^nC_1\, a^{n-1} b \\ &\quad + {}^nC_3\, a^{n-3} b^3 + \cdots\big] \end{aligned}$$
:::

## General and middle terms (exam extra)

Exam extra: in the JEE Main syllabus ("general term and middle term"), not in NCERT. The older NCERT book had this section; the rationalised book removed it.

:::formula{title="General term"}
$$T_{r+1} = {}^nC_r\, a^{n-r}\, b^r$$
This is the **$(r+1)$th** term of $(a+b)^n$, for $r = 0, 1, \dots, n$. For $(a-b)^n$ multiply by $(-1)^r$.
:::

:::formula{title="Middle term(s)"}
$n$ even: one middle term,
$$T_{\frac{n}{2}+1}$$
$n$ odd: two middle terms,
$$T_{\frac{n+1}{2}} \text{ and } T_{\frac{n+3}{2}}$$
:::

## More results (exam extra)

Not in NCERT. They are "simple applications" that JEE Main questions use.

:::formula{title="Greatest binomial coefficient"}
$n$ even: ${}^nC_{n/2}$. $n$ odd: ${}^nC_{(n-1)/2} = {}^nC_{(n+1)/2}$.

These are the coefficients ${}^nC_r$ of the middle term(s). The full coefficient of a term (with the powers of numbers inside $a$ and $b$) can be largest somewhere else.
:::

:::formula{title="Ratio of neighbouring coefficients"}
$$\frac{{}^nC_r}{{}^nC_{r-1}} = \frac{n - r + 1}{r}$$
For $1 \le r \le n$. Useful to compare neighbouring terms.
:::

:::formula{title="Two more coefficient sums"}
$$\sum_{k=0}^{n} k\,{}^nC_k = n\,2^{n-1}$$
$$\sum_{k=0}^{n} \left({}^nC_k\right)^2 = {}^{2n}C_n$$
The first follows from $k\,{}^nC_k = n\,{}^{n-1}C_{k-1}$ (for $n \ge 1$).
:::
