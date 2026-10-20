---
title: "Arithmetic Progressions: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.arithmetic-progressions
order: 1
---

## Symbols used

$a$ = first term, $d$ = common difference, $n$ = number of terms (a positive whole number), $a_n$ = $n$th term, $l$ = last term, $S_n$ (or $S$) = sum of the first $n$ terms.

## The AP itself

:::formula{title="General form of an AP"}
$$a,\ a + d,\ a + 2d,\ a + 3d,\ \dots$$
You need both $a$ and $d$ to write the AP. $d$ can be positive, negative or zero.
:::

:::formula{title="Common difference"}
$$d = a_{k+1} - a_k$$
Any term minus the term **just before** it. A list is an AP only if this gives the same value for every $k$.
:::

:::formula{title="Three numbers in AP"}
$$b = \frac{a + c}{2}$$
$a, b, c$ are in AP exactly when $2b = a + c$. Then $b$ is called the **arithmetic mean** of $a$ and $c$.
:::

## nth term

:::formula{title="nth term (general term)"}
$$a_n = a + (n - 1)\,d$$
Works for every AP and every $n = 1, 2, 3, \dots$ In a finite AP with $m$ terms, the last term is $l = a_m$.
:::

:::formula{title="Number of terms"}
$$n = \frac{l - a}{d} + 1$$
For a finite AP from $a$ to $l$, with $d \ne 0$. It comes from $l = a + (n - 1)d$. The answer must be a positive whole number.
:::

:::formula{title="nth term from the end"}
$$l - (n - 1)\,d$$
For a finite AP with last term $l$. This is the same as reversing the AP: new first term $l$, new common difference $-d$.

If the AP has $m$ terms, the $n$th term from the end is the $(m - n + 1)$th term from the start.
:::

## Sum of the first n terms

:::formula{title="Sum using a and d"}
$$S_n = \frac{n}{2}\left[2a + (n - 1)\,d\right]$$
Use it when you know $a$, $d$ and $n$. If you know any three of $S$, $a$, $d$, $n$, you can find the fourth.
:::

:::formula{title="Sum using the first and last terms"}
$$S = \frac{n}{2}\,(a + l)$$
$l$ = last of the $n$ terms being added. Useful when $d$ is not given.
:::

:::formula{title="Term from the sum"}
$$a_n = S_n - S_{n-1}$$
For $n \ge 2$. For the first term use $a_1 = S_1$.
:::

:::formula{title="Sum of the first n positive integers"}
$$1 + 2 + 3 + \cdots + n = \frac{n(n + 1)}{2}$$
This is the AP with $a = 1$, $d = 1$, $l = n$. For $n = 100$ it gives 5050 (Gauss's sum).
:::
