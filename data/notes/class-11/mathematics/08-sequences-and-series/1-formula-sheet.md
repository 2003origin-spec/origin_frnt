---
title: "Sequences and Series: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.sequences-and-series
order: 1
---

## Any sequence

:::formula{title="Term from the sum"}
$$a_n = S_n - S_{n-1} \quad (n \ge 2)$$
$$a_1 = S_1$$
$S_n$ = sum of the first $n$ terms.
:::

## Arithmetic progression (AP)

A Class 10 topic that is still in the JEE syllabus.

$a$ = first term, $d$ = common difference, $l$ = last term, $n$ = number of terms.

:::formula{title="nth term"}
$$a_n = a + (n-1)\,d$$
From the end, the $n$th term is ${l - (n-1)\,d}$.

Number of terms, for $d \ne 0$:
$$n = \frac{l - a}{d} + 1$$
:::

:::formula{title="Sum of n terms"}
$$S_n = \frac{n}{2}\left[2a + (n-1)\,d\right]$$
$$S_n = \frac{n}{2}\,(a + l)$$
:::

:::formula{title="Arithmetic mean"}
$$A = \frac{a + b}{2}$$
$a, A, b$ are in AP. Three numbers $a, b, c$ are in AP when $2b = a + c$.
:::

:::formula{title="Inserting n arithmetic means between a and b"}
$$d = \frac{b - a}{n + 1}, \qquad A_k = a + k\,d$$
Here $k = 1, 2, \dots, n$, and the whole AP $a, A_1, \dots, A_n, b$ has $n + 2$ terms. The means add up to $n \times \dfrac{a + b}{2}$.
:::

## Geometric progression (GP)

$a$ = first term, $r$ = common ratio ($a \ne 0$, $r \ne 0$).

:::formula{title="nth term"}
$$a_n = a\,r^{n-1}$$
:::

:::formula{title="Sum of n terms"}
$$S_n = \frac{a\,(r^n - 1)}{r - 1} = \frac{a\,(1 - r^n)}{1 - r}$$
For $r \ne 1$. If $r = 1$, then $S_n = na$.
:::

:::formula{title="Sum to infinity"}
$$S_\infty = \frac{a}{1 - r}$$
Only when $|r| < 1$.
:::

:::formula{title="Geometric mean"}
$$G = \sqrt{ab} \qquad (a, b > 0)$$
Three non-zero numbers $a, b, c$ are in GP exactly when $b^2 = ac$.
:::

:::formula{title="Inserting n geometric means between a and b"}
For $a, b > 0$:
$$r = \left(\frac{b}{a}\right)^{\frac{1}{n+1}}, \qquad G_k = a\,r^k$$
Here $k = 1, 2, \dots, n$. With this positive $r$, the means multiply to $\left(\sqrt{ab}\right)^n$.
:::

## AM and GM

:::formula{title="AM ≥ GM"}
$$\frac{a + b}{2} \ge \sqrt{ab} \qquad (a, b > 0)$$
Equal only when $a = b$.
:::

:::formula{title="Numbers from their AM and GM"}
If $A$ and $G$ are the AM and GM of two positive numbers, the numbers are the roots of
$$x^2 - 2Ax + G^2 = 0$$
That is, the numbers are
$$A \pm \sqrt{(A + G)(A - G)}$$
:::

## Exam extras

:::formula{title="Harmonic mean"}
$$H = \frac{2ab}{a + b}$$
$$A \ge G \ge H, \qquad G^2 = AH$$
For two positive numbers. $a, b, c$ are in HP when $\dfrac1a, \dfrac1b, \dfrac1c$ are in AP.
:::

:::formula{title="Sums of natural numbers"}
$$\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$$
$$\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}$$
$$\sum_{k=1}^{n} k^3 = \left[\frac{n(n+1)}{2}\right]^2$$
Sum of the first $n$ odd numbers $= n^2$.
:::

:::formula{title="Arithmetico-geometric series to infinity"}
For $a + (a + d)\,r + (a + 2d)\,r^2 + \cdots$ with $|r| < 1$:
$$S_\infty = \frac{a}{1 - r} + \frac{d\,r}{(1 - r)^2}$$
:::
