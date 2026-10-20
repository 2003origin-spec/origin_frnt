---
title: "Relations and Functions (Class 11): Short Notes"
type: short_notes
chapter: c11.mathematics.relations-and-functions
order: 2
---

## 1. Ordered pairs

- An **ordered pair** $(p, q)$ is two elements written in brackets in a fixed order. $p$ is the first element, $q$ the second.
- $(a, b) = (x, y)$ only when $a = x$ **and** $b = y$.
- Order matters: $(2, 3)$ and $(3, 2)$ are different. Compare sets, where $\{2, 3\} = \{3, 2\}$.
- $(a, b, c)$ is an **ordered triplet**.

## 2. Cartesian product

- For non-empty sets $P$ and $Q$, the **Cartesian product** $P \times Q$ is the set of all ordered pairs $(p, q)$ with $p \in P$ and $q \in Q$.
- If either set is empty, the product is empty: $A \times \phi = \phi$.
- If $n(A) = p$ and $n(B) = q$, then $n(A \times B) = pq$.
- In general $A \times B \ne B \times A$, but both have the same number of elements.
- $A \times A \times A = \{(a, b, c) : a, b, c \in A\}$.
- $\mathbf{R} \times \mathbf{R}$ is the set of all points of the plane; $\mathbf{R} \times \mathbf{R} \times \mathbf{R}$ is the set of all points of space.

:::example{title="Finding A and B from A × B"}
If $A \times B = \{(1, p), (2, p), (3, p), (1, q), (2, q), (3, q)\}$, then $A$ = set of first elements $= \{1, 2, 3\}$ and $B$ = set of second elements $= \{p, q\}$. Check: $3 \times 2 = 6$ pairs.
:::

## 3. Relations

- A **relation** $R$ from a non-empty set $A$ to a non-empty set $B$ is a subset of $A \times B$. It is picked out by a rule linking the first and second elements.
- If $(x, y) \in R$, then $y$ is the **image** of $x$.
- **Domain:** the set of all first elements of the pairs in $R$.
- **Range:** the set of all second elements.
- **Codomain:** the whole set $B$. The range is a subset of the codomain (it may be all of it).
- A relation from $A$ to $A$ is called a **relation on $A$**.
- Ways to show a relation: **roster form** (list the pairs), **set-builder form** (state the rule), or an **arrow diagram**.
- Number of relations from $A$ to $B$ = number of subsets of $A \times B$ = $2^{pq}$.

:::example{title="Domain, range, codomain"}
On $A = \{1, 2, 3, 4, 5, 6\}$, let $R = \{(x, y) : y = x + 1\}$.

$R = \{(1,2), (2,3), (3,4), (4,5), (5,6)\}$. Domain $= \{1, 2, 3, 4, 5\}$, range $= \{2, 3, 4, 5, 6\}$, codomain $= A$.
:::

## 4. Functions

- A relation $f$ from $A$ to $B$ is a **function** if **every** element of $A$ has **one and only one** image in $B$.
- Two ways to fail: some element of $A$ has **no** image, or some element has **two or more** images.
- Equivalently, the domain of $f$ is all of $A$, and no two different pairs in $f$ have the same first element.
- We write $f : A \to B$ and $f(a) = b$. $b$ is the image of $a$; $a$ is a preimage of $b$.
- For a function, the domain is $A$, the codomain is $B$, and the range is the set of all images.
- Different elements **may** share the same image, and some elements of $B$ may have no preimage. Both are allowed.
- "Map" and "mapping" are other names for a function.

:::example{title="Function or not?"}
- $\{(2,1), (3,1), (4,2)\}$: each first element appears once, so it is a function (on $\{2, 3, 4\}$).
- $\{(2,2), (2,4), (3,3)\}$: 2 has two images, so it is **not** a function.
:::

:::tip
**Vertical line test (exam extra, not in NCERT):** a graph in the $xy$-plane is the graph of a function of $x$ when no vertical line meets it at more than one point.
:::

## 5. Real functions

- A **real valued function** has $\mathbf{R}$ or a subset of $\mathbf{R}$ as its range.
- If its domain is also $\mathbf{R}$ or a subset of $\mathbf{R}$, it is a **real function**.
- If a real function is given only by a formula, its domain is the largest set of real $x$ for which the formula gives a real value. (NCERT finds domains this way in its examples.)

## 6. Standard functions and their graphs

| Function | Domain | Range |
|---|---|---|
| Identity $x$ | $\mathbf{R}$ | $\mathbf{R}$ |
| Constant $c$ | $\mathbf{R}$ | $\{c\}$ |
| $x^2$ | $\mathbf{R}$ | $[0, \infty)$ |
| $x^3$ | $\mathbf{R}$ | $\mathbf{R}$ |
| $1/x$ | $\mathbf{R} - \{0\}$ | $\mathbf{R} - \{0\}$ |
| Modulus $\lvert x \rvert$ | $\mathbf{R}$ | $[0, \infty)$ |
| Signum | $\mathbf{R}$ | $\{-1, 0, 1\}$ |
| Greatest integer $[x]$ | $\mathbf{R}$ | $\mathbf{Z}$ |

What the graphs look like:
- **Identity** $y = x$: a straight line through the origin, at $45^\circ$ to the $x$-axis.
- **Constant** $y = c$: a line parallel to the $x$-axis.
- $y = x^2$: a parabola opening upward, symmetric about the $y$-axis, lowest point at the origin.
- $y = x^3$: passes through the origin and always rises; negative for $x < 0$.
- $y = \dfrac1x$: two separate branches, in the 1st and 3rd quadrants. It never meets either axis.
- $y = |x|$: a V shape with its corner at the origin.
- **Signum:** $y = 1$ to the right of the origin, $y = -1$ to the left, and the single point $(0, 0)$.
- $y = [x]$: steps. Each step has a filled dot at its left end and an open dot at its right end.

:::example{title="Greatest integer values"}
$[2.7] = 2$, $[5] = 5$, $[-0.4] = -1$, $[-2.7] = -3$. For a negative non-integer, go **down** to the next integer, not towards zero.
:::

- A **polynomial function** is $a_0 + a_1 x + \cdots + a_n x^n$ with $n$ a non-negative integer. So $x^3 - x^2 + 2$ is one; $x^{2/3} + 2x$ is not (the power is not a whole number).
- A **rational function** is $\dfrac{f(x)}{g(x)}$ with $f$, $g$ polynomials, defined only where $g(x) \ne 0$.
- A **linear function** is $f(x) = mx + c$. Its graph is a straight line. Two points fix it.

## 7. Algebra of real functions

For $f, g : X \to \mathbf{R}$, define at each $x \in X$:
- $(f + g)(x) = f(x) + g(x)$ and $(f - g)(x) = f(x) - g(x)$
- $(\alpha f)(x) = \alpha f(x)$ for a real number $\alpha$
- $(fg)(x) = f(x)\,g(x)$ (pointwise multiplication)
- $\left(\dfrac{f}{g}\right)(x) = \dfrac{f(x)}{g(x)}$, only where $g(x) \ne 0$

:::example{title="Quotient"}
$f(x) = x^2$, $g(x) = 2x + 1$: $\left(\dfrac{f}{g}\right)(x) = \dfrac{x^2}{2x + 1}$, for $x \ne -\dfrac12$.
:::

## 8. Finding domain and range

**Domain:** remove the $x$ values that break the formula.
- Denominator zero: remove the roots of the denominator. For $\dfrac{x^2 + 3x + 5}{x^2 - 5x + 4}$, the domain is $\mathbf{R} - \{1, 4\}$.
- Square root (real values only): the expression under the root must be $\ge 0$. For $\sqrt{16 - x^2}$, the domain is $[-4, 4]$.
- Root in a denominator: the expression must be $> 0$.

**Range:** find which $y$ values are actually reached.
- Use known bounds: $x^2 \ge 0$, $|x| \ge 0$, $\sqrt{u} \ge 0$.
- Or put $y = f(x)$, solve for $x$, and keep the $y$ for which a real $x$ in the domain exists.

:::example{title="A range by bounds"}
$f(x) = 3 - x^2$: since $x^2 \ge 0$, $f(x) \le 3$, and every value from 3 down is reached. Range $= (-\infty, 3]$.
:::

## 9. Where the rest went

Types of relations (reflexive, symmetric, transitive, equivalence), one-one and onto functions, composition and inverse are in the **Class 12** chapter "Relations and Functions". This Class 11 chapter only checks the three properties in one example, without naming them: for $R = \{(a, b) : a - b \in \mathbf{Z}\}$ on $\mathbf{Q}$, $(a, a) \in R$; $(a, b) \in R$ gives $(b, a) \in R$; and $(a, b), (b, c) \in R$ give $(a, c) \in R$.
