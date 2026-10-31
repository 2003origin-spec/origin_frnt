---
title: "Relations and Functions (Class 11): Quick Practice"
type: practice
chapter: c11.mathematics.relations-and-functions
order: 4
---

Try each question first, then tap **Show answer**.

## Cartesian products and relations

:::question{title="1. Equal pairs" exam="JEE Main level"}
If $(x^2 - 3x,\ y + 2x) = (-2,\ 5)$, find all possible $(x, y)$.

---

Equate both parts: $x^2 - 3x = -2$ and $y + 2x = 5$.

$x^2 - 3x + 2 = 0$ gives $(x - 1)(x - 2) = 0$, so $x = 1$ or $x = 2$. Then $y = 5 - 2x$.

**$(x, y) = (1, 3)$ or $(2, 1)$.**
:::

:::question{title="2. Common pairs" exam="JEE Main level"}
$A = \{1, 2, 3\}$ and $B = \{2, 3, 4\}$. How many elements does $(A \times B) \cap (B \times A)$ have?

---

A pair $(x, y)$ is in both only if $x \in A$ and $x \in B$, and $y \in B$ and $y \in A$. So $x, y \in A \cap B = \{2, 3\}$.

The pairs are $(2,2), (2,3), (3,2), (3,3)$: **4 elements**.
:::

:::question{title="3. Domain and range" exam="JEE Main level"}
On $A = \{1, 2, 3, 4, 5, 6\}$, let $R = \{(x, y) : y = 2x - 1;\ x, y \in A\}$. Find the domain and range of $R$. Is $R$ a function from $A$ to $A$?

---

$x = 1, 2, 3$ give $y = 1, 3, 5$. For $x = 4$, $y = 7 \notin A$, and so on. So $R = \{(1,1), (2,3), (3,5)\}$.

**Domain $\{1, 2, 3\}$, range $\{1, 3, 5\}$. Not a function from $A$ to $A$**, because 4, 5 and 6 have no image.
:::

:::question{title="4. Counting" exam="JEE Main level"}
$n(A) = 3$ and $n(B) = 4$. Find the number of relations from $A$ to $B$, and the number of functions from $A$ to $B$.

---

$n(A \times B) = 12$, so there are $2^{12} = 4096$ relations.

Each of the 3 elements of $A$ picks one of 4 images: $4^3 = 64$ functions (not $3^4 = 81$).

**4096 relations, 64 functions.**
:::

## Functions

:::question{title="5. Making it a function" exam="JEE Main level"}
A rule on $[0, 5]$ is $f(x) = x + 1$ for $0 \le x \le 2$ and $f(x) = kx$ for $2 \le x \le 5$. For what $k$ is $f$ a function? Then find $f(4)$.

---

$x = 2$ is in both pieces, so both must give the same value: $2 + 1 = 2k$, so $k = \dfrac32$.

Then $f(4) = \dfrac32 \times 4 = 6$. **$k = \dfrac32$, $f(4) = 6$.**
:::

:::question{title="6. Quotient of functions" exam="JEE Main level"}
$f(x) = x^2 - 4$ and $g(x) = x - 2$ on $\mathbf{R}$. Find $\left(\dfrac{f}{g}\right)(x)$ and its domain. Is $\dfrac{f}{g}$ the same function as $h(x) = x + 2$, $x \in \mathbf{R}$?

---

$\left(\dfrac{f}{g}\right)(x) = \dfrac{(x - 2)(x + 2)}{x - 2} = x + 2$, but only where $g(x) \ne 0$, that is $x \ne 2$.

**$\dfrac{f}{g}(x) = x + 2$ with domain $\mathbf{R} - \{2\}$. It is not the same as $h$**, because the domains differ.
:::

## Domain and range

:::question{title="7. Root plus fraction" exam="JEE Main level"}
Find the domain of $f(x) = \sqrt{4 - x^2} + \dfrac{1}{x - 1}$.

---

Root: $4 - x^2 \ge 0$, so $-2 \le x \le 2$. Fraction: $x \ne 1$.

**Domain $= [-2, 1) \cup (1, 2]$.**
:::

:::question{title="8. Root in the denominator" exam="JEE Main level"}
Find the domain of $f(x) = \dfrac{1}{\sqrt{x^2 - 5x + 6}}$.

---

The root must be real **and** non-zero: $x^2 - 5x + 6 > 0$, that is $(x - 2)(x - 3) > 0$.

This holds for $x < 2$ or $x > 3$. **Domain $= (-\infty, 2) \cup (3, \infty)$.**
:::

:::question{title="9. A range" exam="JEE Main level"}
Find the range of $f(x) = \dfrac{x^2 - 1}{x^2 + 1}$, $x \in \mathbf{R}$.

---

Write $f(x) = 1 - \dfrac{2}{x^2 + 1}$.

$x^2 + 1$ takes every value in $[1, \infty)$, so $\dfrac{2}{x^2 + 1}$ takes every value in $(0, 2]$.

So $f(x)$ takes every value in $[-1, 1)$. It is $-1$ at $x = 0$ and never reaches 1. **Range $= [-1, 1)$.**
:::

## Greatest integer function

:::question{title="10. An equation in [x]" exam="JEE Main level"}
Solve $[x]^2 - 5[x] + 6 = 0$, where $[x]$ is the greatest integer function.

---

Put $n = [x]$: $n^2 - 5n + 6 = 0$, so $n = 2$ or $n = 3$.

$[x] = 2$ means $2 \le x < 3$; $[x] = 3$ means $3 \le x < 4$. Together: **$x \in [2, 4)$**.
:::
