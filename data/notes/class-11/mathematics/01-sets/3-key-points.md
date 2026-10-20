---
title: "Sets: Important Points and Traps"
type: key_points
chapter: c11.mathematics.sets
order: 3
---

## NCERT one-liners

:::remember
- A set is a **well-defined** collection of objects.
- $\phi$ is a subset of every set, and every set is a subset of itself.
- A set does not change if elements are repeated or reordered.
- $\phi$ is a **finite** set: $n(\phi) = 0$.
- Intervals are subsets of $\mathbf{R}$. Every interval has infinitely many points.
- $A - B$, $A \cap B$ and $B - A$ are mutually disjoint.
- $(A \cup B)' = A' \cap B'$ and $(A \cap B)' = A' \cup B'$.
:::

:::remember
NCERT's $\subset$ means "subset, equality allowed". If a question uses $\subseteq$, then its $\subset$ (or $\subsetneq$) usually means **proper** subset. Read the symbols in each question.
:::

## Element or subset?

:::trap
Ask "is this thing **listed** in the braces?" for $\in$, and "is **every element** of it listed?" for $\subset$.

For $A = \{1, 2, \{3, 4\}, 5\}$:
- $\{3, 4\} \in A$ is true, but $\{3, 4\} \subset A$ is false (3 is not an element of $A$).
- $\{\{3, 4\}\} \subset A$ is true.
- $\phi \subset A$ is true, but $\phi \in A$ and $\{\phi\} \subset A$ are false.
- $1 \subset A$ is wrong: 1 is an element, not a set. Write $1 \in A$ or $\{1\} \subset A$.
:::

:::trap
$\phi$, $\{0\}$ and $\{\phi\}$ are three different sets. $n(\phi) = 0$, but $n(\{0\}) = n(\{\phi\}) = 1$. Also $\phi \in \{\phi\}$ and $\phi \subset \{\phi\}$ are both true.
:::

- $A \subset B$ and $B \subset C$ give $A \subset C$. But $A \in B$ and $B \subset C$ only give $A \in C$, not $A \subset C$.
- $A \not\subset B$ and $B \not\subset C$ do **not** give $A \not\subset C$. Example: $A = C = \{1\}$, $B = \{2\}$.
- If $A \subset B$ and $x \notin B$, then $x \notin A$.

## Writing and counting elements

:::trap
Count **distinct** elements only. TRIGONOMETRY gives $\{T, R, I, G, O, N, M, E, Y\}$: 9 elements, not 12. MATHEMATICS gives 8.
:::

- In NCERT, $\mathbf{N} = \{1, 2, 3, \dots\}$. Check whether 0 is allowed before listing, e.g. $\{x \in \mathbf{N} : x < 4\} = \{1, 2, 3\}$ but $\{x \in \mathbf{Z} : 0 \le x < 4\} = \{0, 1, 2, 3\}$.
- Read the number set carefully: $\{x \in \mathbf{Z} : x^2 \le 4\}$ has 5 elements; $\{x \in \mathbf{R} : x^2 \le 4\} = [-2, 2]$ is infinite.

## Intervals

:::trap
$\infty$ is not a number, so it always takes a **round** bracket: write $[3, \infty)$, never $[3, \infty]$.
:::

- Watch the ends when combining intervals: $[-2, 5) \cap (1, 7] = (1, 5)$, which keeps neither 1 nor 5.
- $(a, b)$ can also mean a point or an ordered pair. In this chapter it is an interval only when $a < b$ are real numbers.

## Operations and laws

:::trap
**No cancelling.** $A \cap B = A \cap C$ does not give $B = C$. Example: $A = \{1\}$, $B = \{1, 2\}$, $C = \{1, 3\}$. The same goes for $A \cup B = A \cup C$ alone.

But if **both** $A \cup B = A \cup C$ and $A \cap B = A \cap C$, then $B = C$ (NCERT exercise).
:::

- $A - B \ne B - A$ in general. They are equal only when $A = B$, and then both are $\phi$.
- $A \cup B = A \cap B$ happens only when $A = B$.
- $A \subset B$, $A - B = \phi$, $A \cup B = B$ and $A \cap B = A$ all say the same thing.
- $A - (B \cup C) = (A - B) \cap (A - C)$, with $\cap$, not $\cup$ (De Morgan inside $A$; exam extra: an algebraic property in the JEE Main syllabus, not in NCERT).

:::trap
The complement depends on $U$. Take $A = \{2, 4, 6, \dots\}$. With $U = \mathbf{N}$, $A' = \{1, 3, 5, \dots\}$. With $U = \mathbf{Z}$, $A'$ also contains 0 and every negative integer.
:::

- A universal set must contain **every** set in the question. For $\{1, 3, 5\}$, $\{2, 4, 6\}$ and $\{0, 2, 4, 6, 8\}$, the set $\{0, 1, \dots, 10\}$ works, but $\{0, 1, \dots, 6\}$ does not (8 is missing).

:::tip
De Morgan: "break the bar, flip the sign". Taking the complement of a union or intersection puts a dash on each set and turns $\cup$ into $\cap$, or $\cap$ into $\cup$.
:::

:::tip
To prove $X = Y$, take any $x \in X$ and show $x \in Y$; then take any $y \in Y$ and show $y \in X$. This is how NCERT proves that $A \cup B = A \cap B$ gives $A = B$.
:::

## Counting (exam extra, not in the current NCERT)

:::trap
$2^m$ subsets **includes** $\phi$ and $A$ itself. Proper subsets: $2^m - 1$. Non-empty proper subsets: $2^m - 2$. $\phi$ has exactly one subset and no proper subset.
:::

- $n(P(\phi)) = 1$ and $n(P(P(\phi))) = 2$.
- "At least one of $A, B$" is $A \cup B$. "Neither" is $(A \cup B)' = A' \cap B'$. "Exactly one" is $(A - B) \cup (B - A)$, also written $A \,\Delta\, B$ (symmetric difference, beyond the syllabus).
- For three sets, exactly one $= \Sigma n(A) - 2\,\Sigma n(A \cap B) + 3\,n(A \cap B \cap C)$, where each $\Sigma$ runs over the three sets or the three pairs.

:::tip
For counting questions, draw the Venn diagram and fill it **from the inside out**: first the triple overlap, then "pair only" regions, then "only $A$" regions. Every region is then easy to read off.
:::

:::remember
Bounds on the overlap of finite $A$ and $B$ inside $U$:
- largest $n(A \cap B) = $ the smaller of $n(A)$ and $n(B)$;
- smallest $n(A \cap B) = n(A) + n(B) - n(U)$, or 0 if that is negative.
:::
