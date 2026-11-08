---
title: "Relations and Functions (Class 11): Important Points and Traps"
type: key_points
chapter: c11.mathematics.relations-and-functions
order: 3
---

## Ordered pairs and products

:::remember
- $(a, b) = (x, y)$ means $a = x$ **and** $b = y$. Equate both parts.
- $n(A \times B) = pq$, and $A \times \phi = \phi$.
- In general $A \times B \ne B \times A$, but $n(A \times B) = n(B \times A)$.
- $A \times B$ is a set of $pq$ **pairs**, so it has $2^{pq}$ subsets. Each subset is a relation from $A$ to $B$.
:::

:::trap
$(a, b) \ne (b, a)$ unless $a = b$. But the sets $\{a, b\}$ and $\{b, a\}$ are equal. Do not mix up brackets.
:::

- (Exam extra) For non-empty $A$ and $B$, $A \times B = B \times A$ only when $A = B$.
- (Exam extra) $(A \times B) \cap (B \times A) = (A \cap B) \times (A \cap B)$.
- To find $A$ and $B$ from $A \times B$: $A$ = all first elements, $B$ = all second elements.

:::trap
$A \times A$ with 9 elements means $n(A) = 3$, because $3 \times 3 = 9$. If two pairs of $A \times A$ are given, every element appearing in them (first **or** second place) belongs to $A$.
:::

## Relations

:::remember
- Relation from $A$ to $B$ = any subset of $A \times B$, **including** $\phi$ and $A \times B$ itself.
- Number of relations from $A$ to $B$ = $2^{pq}$. On a set of $n$ elements: $2^{n^2}$.
- Range $\subseteq$ codomain. The codomain is the whole set $B$, used or not.
:::

:::trap
Range and codomain are **not** the same thing. For $R = \{(x, y) : y = x + 1\}$ on $\{1, \dots, 6\}$, the range is $\{2, \dots, 6\}$ but the codomain is $\{1, \dots, 6\}$.
:::

:::trap
The domain of a relation is the set of first elements that **actually appear** in its pairs, not the whole set $A$. Elements of $A$ with no partner are left out.
:::

- (Exam extra) Number of non-empty relations from $A$ to $B$ = $2^{pq} - 1$.

## Functions

:::remember
A function from $A$ to $B$ needs **every** element of $A$ to have **exactly one** image.
- Many elements may share one image. That is fine.
- Some elements of $B$ may have no preimage. That is fine.
- Every function is a relation, but not every relation is a function.
:::

:::trap
A relation from $A$ to $B$ is **not** a function from $A$ to $B$ if even one element of $A$ has **no** image. For $y = x + 1$ on $\{1, \dots, 6\}$, the element 6 has no image, so it is not a function from $A$ to $A$.
:::

:::trap
**Overlapping pieces.** If a rule is given in pieces that share an end point, both pieces must give the **same value** there. For $x + 4$ on $[0, 2]$ and $x^2$ on $[2, 5]$, $x = 2$ gets 6 and 4, so it is **not** a function. With $x + 2$ in place of $x + 4$, both pieces give 4 at $x = 2$, and it is a function.
:::

:::trap
**Hidden double images.** For a rule like $f = \{(a - b, a + b) : a, b \in \mathbf{Z}\}$, test a first element that can be made in two ways. $0 = 1 - 1 = 2 - 2$ gives images 2 and 4, so $f$ is not a function.
:::

- (Exam extra) Number of functions from $A$ to $B$ = $q^p$ (not $p^q$). Each element of $A$ has $q$ choices.

## Domain and range

:::trap
**Find the domain before you simplify.** $\dfrac{x^2 - 1}{x - 1}$ has domain $\mathbf{R} - \{1\}$, even though it simplifies to $x + 1$. So it is not the same function as $x + 1$ on $\mathbf{R}$.
:::

:::trap
$\sqrt{u}$ needs $u \ge 0$, but $\dfrac{1}{\sqrt{u}}$ needs $u > 0$. Watch the end points: the first keeps them, the second drops them.
:::

- $x^2$ on $\mathbf{R}$ has range $[0, \infty)$, not $\mathbf{R}$. $x^3$ on $\mathbf{R}$ has range $\mathbf{R}$.
- $\dfrac1x$ never takes the value 0, so its range is $\mathbf{R} - \{0\}$.
- $\dfrac{1}{1 + x^2}$ has range $(0, 1]$: it reaches 1 at $x = 0$ but never reaches 0.
- (Exam extra) $f \pm g$ and $fg$ live where **both** $f$ and $g$ are defined. $\dfrac{f}{g}$ also drops the zeros of $g$.

## Special functions

:::trap
**Greatest integer of a negative number:** $[-2.3] = -3$, not $-2$. $[x]$ is the integer at or **below** $x$ on the number line.
:::

:::remember
- $[x] = x$ only when $x$ is an integer.
- $[x] = n$ means $n \le x < n + 1$. To solve an equation in $[x]$, first find the integer $n$, then turn it into an interval.
- Signum: $\text{sgn}(0) = 0$, not 1 or $-1$. The range is exactly $\{-1, 0, 1\}$.
- $|x| = -x$ when $x < 0$. So $|x|$ is never negative.
:::

- (Exam extra) $[x + k] = [x] + k$ for an integer $k$. For a non-integer $x$, $[x] + [-x] = -1$; for an integer, it is 0.
- Notation: NCERT writes the greatest integer function as $[x]$. Some books use $\lfloor x \rfloor$ (floor).

:::tip
**One input, one output.** Read every "is it a function?" question as: does each element of the first set send out exactly one arrow? Arrows **arriving** together at one image are fine.
:::

:::tip
**Counting:** relations from $A$ to $B$ = $2^{\text{(pairs)}}$, functions from $A$ to $B$ = $(\text{size of } B)^{(\text{size of } A)}$. The set you map **from** goes in the power.
:::
