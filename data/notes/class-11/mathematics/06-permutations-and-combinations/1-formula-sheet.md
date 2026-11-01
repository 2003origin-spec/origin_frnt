---
title: "Permutations and Combinations: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.permutations-and-combinations
order: 1
---

## Counting principles

:::formula{title="Multiplication principle (fundamental principle of counting)"}
$$\text{Total ways} = m \times n$$
One event can happen in $m$ ways, and **after it** a second event can happen in $n$ ways. Works for any number of events in succession: $m \times n \times p \times \cdots$
:::

:::formula{title="Addition principle (cases)"}
$$\text{Total ways} = m + n$$
When the work is done in **either** one way **or** another (cases that cannot happen together). NCERT uses it in Example 4 (signals of 2, 3, 4 or 5 flags) but does not name it.
:::

## Factorial

:::formula{title="n factorial"}
$$n! = 1 \times 2 \times 3 \times \cdots \times n$$
$$n! = n\,(n-1)!$$
$$0! = 1$$
$n$ is a natural number, and $0! = 1$ is taken as a definition. $n!$ is not defined for negative $n$ or fractions.
:::

## Permutations (order matters)

:::formula{title="n different objects, r at a time, no repetition"}
$$^{n}P_{r} = \frac{n!}{(n-r)!}$$
$$^{n}P_{r} = n(n-1)(n-2)\cdots(n-r+1)$$
For $0 \le r \le n$. Special cases: $^{n}P_{n} = n!$ and $^{n}P_{0} = 1$.
:::

:::formula{title="n different objects, r at a time, repetition allowed"}
$$\text{Number of arrangements} = n^r$$
Each of the $r$ places can be filled in $n$ ways. Here $r$ can be bigger than $n$.
:::

:::formula{title="Objects not all different (all taken at a time)"}
$$\frac{n!}{p_1!\,p_2!\cdots p_k!}$$
$n$ objects in all: $p_1$ alike of one kind, $p_2$ alike of a second kind, ..., $p_k$ alike of a $k$th kind, the rest all different.
:::

## Combinations (order does not matter)

:::formula{title="n different objects, r at a time"}
$$^{n}C_{r} = \frac{n!}{r!\,(n-r)!}$$
For $0 \le r \le n$. $^{n}C_{0} = {}^{n}C_{n} = 1$. Another symbol for it is $\dbinom{n}{r}$.
:::

:::formula{title="Link between P and C"}
$$^{n}P_{r} = {}^{n}C_{r} \times r!$$
Choose the $r$ objects, then arrange them in $r!$ ways.
:::

:::formula{title="Choosing = rejecting"}
$$^{n}C_{r} = {}^{n}C_{n-r}$$
Choosing $r$ objects is the same as leaving out the other $n - r$.
:::

:::formula{title="Equal C values"}
$$^{n}C_{a} = {}^{n}C_{b}$$
$$\Rightarrow a = b \ \text{ or } \ a + b = n$$
:::

:::formula{title="Pascal's rule (NCERT Theorem 6)"}
$$^{n}C_{r} + {}^{n}C_{r-1} = {}^{n+1}C_{r}$$
For $1 \le r \le n$.
:::

## Exam extras (JEE Main, not in NCERT)

Not in the NCERT book. JEE Main asks them under its "permutations and combinations, simple applications" unit.

:::formula{title="Ratio of neighbouring C values"}
$$\frac{{}^{n}C_{r}}{{}^{n}C_{r-1}} = \frac{n - r + 1}{r}$$
For $1 \le r \le n$. $^{n}C_{r}$ is largest at $r = \dfrac{n}{2}$ ($n$ even), or at $r = \dfrac{n-1}{2}$ and $\dfrac{n+1}{2}$ ($n$ odd).
:::

:::formula{title="Selections of at least one"}
$$\text{From } n \text{ different objects: } 2^n - 1$$
From $p$ alike + $q$ alike + $r$ alike objects (three kinds):
$$(p+1)(q+1)(r+1) - 1$$
Drop the "$-1$" if choosing nothing is allowed.
:::

:::formula{title="Circular arrangements"}
$$\text{Circle of } n \text{ objects} = (n-1)!$$
$$\text{Necklace or garland} = \frac{(n-1)!}{2}$$
The necklace formula is for $n \ge 3$ different beads, when turning it over gives the same thing.
:::

:::formula{title="Points, lines and polygons"}
$n$ points, no three on a line:
$$\text{Lines} = {}^{n}C_{2}$$
$$\text{Triangles} = {}^{n}C_{3}$$
If $m$ of them lie on one line (and no other three do):
$$\text{Lines} = {}^{n}C_{2} - {}^{m}C_{2} + 1$$
$$\text{Triangles} = {}^{n}C_{3} - {}^{m}C_{3}$$
Diagonals of an $n$-sided polygon:
$$^{n}C_{2} - n = \frac{n(n-3)}{2}$$
:::

:::formula{title="Integer solutions (stars and bars)"}
Solutions of $x_1 + x_2 + \cdots + x_r = n$:
$$\text{Non-negative } (x_i \ge 0): \ {}^{n+r-1}C_{r-1}$$
$$\text{Positive } (x_i \ge 1): \ {}^{n-1}C_{r-1}$$
Here $n$ and $r$ are positive whole numbers; positive solutions need $n \ge r$. Same as giving $n$ **identical** things to $r$ different people.
:::

:::formula{title="Number of divisors"}
If $N = p^a\, q^b\, s^c$ with $p, q, s$ different primes:
$$\text{Divisors of } N = (a+1)(b+1)(c+1)$$
This count includes 1 and $N$.
:::
