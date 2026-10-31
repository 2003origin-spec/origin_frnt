---
title: "Sets: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.sets
order: 1
---

## Notation (as in NCERT)

- $a \in A$: $a$ belongs to $A$. $\ b \notin A$: $b$ does not belong to $A$.
- $\phi$ or $\{\ \}$: the empty set (other books also write $\varnothing$).
- $\mathbf{N}$ = natural numbers $\{1, 2, 3, \dots\}$ (0 is **not** included), $\mathbf{Z}$ = integers, $\mathbf{Q}$ = rationals, $\mathbf{R}$ = reals, $\mathbf{T}$ = irrationals. $\mathbf{Z^+}, \mathbf{Q^+}, \mathbf{R^+}$ = the positive ones.
- $n(A)$ = number of **distinct** elements of a finite set $A$.

:::trap
NCERT writes $A \subset B$ for "A is a subset of B", and this **allows** $A = B$. Many JEE books write $A \subseteq B$ for this and keep $A \subset B$ for a proper subset. These notes follow NCERT.
:::

## Subsets and equal sets

:::formula{title="Subset"}
$$A \subset B \iff (a \in A \Rightarrow a \in B)$$
Every element of $A$ is in $B$. Always true: $A \subset A$ and $\phi \subset A$.
:::

:::formula{title="Equal sets"}
$$A = B \iff A \subset B \text{ and } B \subset A$$
Same elements. Order and repeats do not matter.
:::

:::formula{title="Proper subset"}
$A$ is a **proper subset** of $B$ (and $B$ a **superset** of $A$) when
$$A \subset B \text{ and } A \ne B$$
:::

## Intervals (subsets of R)

For $a, b \in \mathbf{R}$ with $a < b$:

:::formula{title="Four kinds of interval"}
$$(a, b) = \{x : a < x < b\}$$
$$[a, b] = \{x : a \le x \le b\}$$
$$[a, b) = \{x : a \le x < b\}$$
$$(a, b] = \{x : a < x \le b\}$$
Round bracket: end point left out. Square bracket: end point included.
:::

:::formula{title="Length of an interval"}
$$\text{length} = b - a$$
The same for all four kinds. Each interval has infinitely many points.
:::

## Operations

All sets here are subsets of a universal set $U$.

:::formula{title="Union"}
$$A \cup B = \{x : x \in A \text{ or } x \in B\}$$
"Or" includes "both". Common elements are written once.
:::

:::formula{title="Intersection"}
$$A \cap B = \{x : x \in A \text{ and } x \in B\}$$
$A$ and $B$ are **disjoint** when $A \cap B = \phi$.
:::

:::formula{title="Difference"}
$$A - B = \{x : x \in A \text{ and } x \notin B\}$$
In general $A - B \ne B - A$. Also $A - B = A \cap B'$ (exam extra: easy to check, not stated in NCERT).
:::

:::formula{title="Complement"}
$$A' = \{x : x \in U \text{ and } x \notin A\}$$
$$A' = U - A$$
:::

## Laws

:::formula{title="Laws of union"}
$$A \cup B = B \cup A$$
$$(A \cup B) \cup C = A \cup (B \cup C)$$
$$A \cup \phi = A$$
$$A \cup A = A$$
$$U \cup A = U$$
Commutative, associative, identity ($\phi$), idempotent, law of $U$.
:::

:::formula{title="Laws of intersection"}
$$A \cap B = B \cap A$$
$$(A \cap B) \cap C = A \cap (B \cap C)$$
$$\phi \cap A = \phi$$
$$U \cap A = A$$
$$A \cap A = A$$
:::

:::formula{title="Distributive laws"}
$$A \cap (B \cup C) = (A \cap B) \cup (A \cap C)$$
This one is in NCERT. The other one is also always true (exam extra: an "algebraic property" in the JEE Main syllabus, not in NCERT):
$$A \cup (B \cap C) = (A \cup B) \cap (A \cup C)$$
:::

:::formula{title="Complement laws"}
$$A \cup A' = U$$
$$A \cap A' = \phi$$
$$(A')' = A$$
$$\phi' = U$$
$$U' = \phi$$
:::

:::formula{title="De Morgan's laws"}
$$(A \cup B)' = A' \cap B'$$
$$(A \cap B)' = A' \cup B'$$
:::

:::formula{title="Results from NCERT's exercises"}
Each of these says the same thing as $A \subset B$:
$$A - B = \phi$$
$$A \cup B = B$$
$$A \cap B = A$$
Absorption, for any $A$ and $B$:
$$A \cup (A \cap B) = A$$
$$A \cap (A \cup B) = A$$
Splitting a set:
$$A = (A \cap B) \cup (A - B)$$
$$A \cup (B - A) = A \cup B$$
:::

## Exam extras (not in the current NCERT)

The current NCERT book (reprint 2025-26) has none of these. The power set is named in the JEE Main syllabus. The counting results are not named there, but JEE Main asks them under union and intersection of sets. The symmetric difference is in neither (see its box).

:::formula{title="Number of subsets and the power set"}
If $n(A) = m$, then $A$ has $2^m$ subsets and $2^m - 1$ proper subsets.

The **power set** $P(A)$ is the set of all subsets of $A$:
$$n\big(P(A)\big) = 2^{m}$$
Example: $P(\phi) = \{\phi\}$, which has 1 element.
:::

:::formula{title="Counting two sets"}
For finite sets $A$ and $B$:
$$n(A \cup B) = n(A) + n(B) - n(A \cap B)$$
If $A$ and $B$ are disjoint:
$$n(A \cup B) = n(A) + n(B)$$
:::

:::formula{title="Difference and complement counts"}
$$n(A - B) = n(A) - n(A \cap B)$$
$$n(A') = n(U) - n(A)$$
$$n(A' \cap B') = n(U) - n(A \cup B)$$
:::

:::formula{title="Counting three sets"}
$$\begin{aligned} &n(A \cup B \cup C) \\ &= n(A) + n(B) + n(C) \\ &\quad - n(A \cap B) - n(B \cap C) \\ &\quad - n(C \cap A) + n(A \cap B \cap C) \end{aligned}$$
For finite sets $A$, $B$, $C$.
:::

:::formula{title="Symmetric difference (beyond the syllabus)"}
Not in NCERT and not named in the JEE Main syllabus. It is only a short name for a set built from difference and union:
$$A \,\Delta\, B = (A - B) \cup (B - A)$$
$$A \,\Delta\, B = (A \cup B) - (A \cap B)$$
$$n(A \,\Delta\, B) = n(A) + n(B) - 2\,n(A \cap B)$$
The elements in exactly one of $A$ and $B$.
:::
