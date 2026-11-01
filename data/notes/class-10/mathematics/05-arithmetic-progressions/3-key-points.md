---
title: "Arithmetic Progressions: Important Points and Traps"
type: key_points
chapter: c10.mathematics.arithmetic-progressions
order: 3
---

## NCERT one-liners

:::remember
- An AP is a list in which each term, except the first, is the term before it **plus a fixed number** $d$.
- $d$ can be positive, negative or **zero**. $3, 3, 3, \dots$ is an AP with $d = 0$.
- To know an AP you need **both** $a$ and $d$.
- A finite AP has a last term. An infinite AP has none.
- $a, b, c$ are in AP when $b = \dfrac{a + c}{2}$. $b$ is the arithmetic mean of $a$ and $c$.
:::

## Common difference

:::trap
Always subtract **later term minus earlier term**: $d = a_2 - a_1$, even when $a_2$ is smaller. For $6, 3, 0, \dots$ the common difference is $3 - 6 = -3$, not $+3$.
:::

:::trap
Checking two differences is not enough to prove a list is an AP. $1, 1, 1, 2, 2, 2, \dots$ has differences $0, 0, 1$. Check every difference you can see.
:::

- Not APs: $2, 4, 8, 16, \dots$ (doubling), $1, 4, 9, 16, \dots$ (squares), $1, 1, 2, 3, 5, \dots$ (Fibonacci), $-2, 2, -2, 2, \dots$
- Money growing at **compound** interest is not an AP. Money growing at **simple** interest is.
- A taxi fare of a fixed amount for the first km and a fixed rate for each extra km **is** an AP.

## nth term

:::trap
$n$ is a counting number. If solving gives $n = 33.6$ or $n = -2$, the number is **not** a term of the AP.
:::

:::trap
Counting terms: $n = \dfrac{l - a}{d} + 1$. Forgetting the **+1** is the most common slip.

From 12 to 99 in steps of 3: $\dfrac{87}{3} = 29$ steps, but **30** terms.
:::

:::trap
"Between 10 and 250" usually means 10 and 250 are **not** included. Find the first and last numbers that really fit before counting.
:::

:::trap
In an AP with $m$ terms, the $k$th term from the end is term number $m - k + 1$ from the start. With 25 terms, the 11th from the end is the **15th** term, not the 14th.
:::

## Sum

:::trap
In $S_n = \dfrac{n}{2}\left[2a + (n - 1)d\right]$, the bracket has **$2a$**, not $a$. In $S = \dfrac{n}{2}(a + l)$, $l$ must be the last of the terms you are adding.
:::

:::trap
When $n$ comes from a quadratic, check **both** roots. Reject a root that is negative or not whole. If both roots are positive whole numbers, **both** can be correct.

For $24, 21, 18, \dots$ the sum is 78 for both $n = 4$ and $n = 13$. The 5th to 13th terms add up to zero.
:::

:::trap
$a_n = S_n - S_{n-1}$ works only for $n \ge 2$. Find the first term as $a_1 = S_1$.
:::

- $S_1 = a_1$ and $S_2 = a_1 + a_2$, so $a_2 = S_2 - S_1$.
- "Total in the first 20 weeks" needs $S_{20}$. "Amount in the 20th week" needs $a_{20}$. Read the question twice.

## Handy shortcuts

:::tip
If $a_n$ is given as a formula like $pn + q$, the list is an AP with $d = p$ (the number multiplying $n$). Example: $a_n = 9 - 5n$ gives $d = -5$.
:::

:::tip
Sum of the first $n$ odd numbers: $1 + 3 + 5 + \cdots$ ($n$ terms) $= \dfrac{n}{2}\left[2 + (n - 1)2\right] = n^2$.
:::

:::tip
Three numbers in AP can be taken as $a - d,\ a,\ a + d$. Here $a$ is the **middle** term, not the first term. Their sum is $3a$, which gives $a$ at once. (beyond the Class 10 book: it is just a smart way to name the terms.)
:::

:::remember
Exercise 5.4 in NCERT is marked optional, "not from the examination point of view".
:::
