---
title: "Sets: Short Notes"
type: short_notes
chapter: c11.mathematics.sets
order: 2
---

## 1. What a set is

- A **set** is a **well-defined** collection of objects: for any object, you can say for sure whether it belongs or not.
- "Rivers of India" is a set. "Five most renowned mathematicians" is **not**, because "most renowned" changes from person to person.
- Objects, elements and members mean the same thing. Sets get capital letters ($A, B, X$), elements small letters ($a, b, x$).
- $a \in A$ means "$a$ belongs to $A$"; $b \notin A$ means "$b$ does not belong to $A$".

## 2. Two ways to write a set

| Form | How | Example |
|---|---|---|
| Roster | List the elements in braces | $\{1, 2, 3, 6\}$ |
| Set-builder | State the common property | $\{x : x \in \mathbf{N},\ x \text{ divides } 6\}$ |

- In set-builder form, the braces mean "the set of all" and the colon means "such that".
- In roster form the **order does not matter** and repeats are **not** counted. Letters of SCHOOL: $\{S, C, H, O, L\}$.
- An infinite set can sometimes be listed with dots: $\{1, 3, 5, \dots\}$. Not every infinite set can be: the set $\mathbf{R}$ of real numbers cannot be written in roster form.

:::example{title="Roster to set-builder"}
$\left\{\tfrac12, \tfrac23, \tfrac34, \tfrac45, \tfrac56, \tfrac67\right\} = \left\{x : x = \tfrac{n}{n+1},\ n \in \mathbf{N},\ 1 \le n \le 6\right\}$
:::

## 3. Empty and singleton sets

- The **empty** (null, void) set $\phi$ or $\{\ \}$ has no element. Examples: natural numbers between 1 and 2; rational $x$ with $x^2 = 2$; even primes greater than 2.
- A **singleton** set has exactly one element, such as $\{a\}$ or $\{0\}$.

:::trap
$\{0\}$ and $\{\phi\}$ are **not** empty. Each has one element.
:::

## 4. Finite and infinite sets

- $n(S)$ = number of **distinct** elements of $S$.
- A set is **finite** if it is empty or has a definite number of elements; otherwise it is **infinite**. So $\phi$ is finite, with $n(\phi) = 0$.
- Finite: days of the week, solutions of $x^2 - 16 = 0$. Infinite: points on a line, primes, odd natural numbers.

## 5. Equal sets

- $A = B$ when they have **exactly the same elements**. $\{1, 2, 3\} = \{3, 2, 2, 1\}$.
- Letters of ALLOY and of LOYAL give the same set $\{A, L, O, Y\}$.
- Equal sets have the same $n$, but the same $n$ does not make sets equal: $\{1, 2\} \ne \{3, 4\}$.

## 6. Subsets

- $A \subset B$ when every element of $A$ is in $B$. If not, $A \not\subset B$.
- Every set is a subset of itself, and $\phi$ is a subset of every set.
- $A \subset B$ and $B \subset A$ together mean $A = B$.
- If $A \subset B$ and $A \ne B$, $A$ is a **proper subset** of $B$, and $B$ is a **superset** of $A$.
- Number sets: $\mathbf{N} \subset \mathbf{Z} \subset \mathbf{Q} \subset \mathbf{R}$, and $\mathbf{T} \subset \mathbf{R}$, where $\mathbf{T} = \{x : x \in \mathbf{R},\ x \notin \mathbf{Q}\}$ (irrationals such as $\sqrt2$, $\pi$). $\mathbf{N} \not\subset \mathbf{T}$.

:::remember
$\in$ links an **element** to a set. $\subset$ links a **set** to a set. If $A = \{1, \{2\}\}$, then $\{2\} \in A$ but $\{2\} \not\subset A$, since $2 \notin A$.
:::

:::example{title="All subsets of {−1, 0, 1}"}
$\phi$; $\{-1\}, \{0\}, \{1\}$; $\{-1, 0\}, \{-1, 1\}, \{0, 1\}$; $\{-1, 0, 1\}$. That is 8 subsets.
:::

## 7. Intervals

For real $a < b$:

| Interval | Set | Ends |
|---|---|---|
| $(a, b)$ | $a < x < b$ | both left out |
| $[a, b]$ | $a \le x \le b$ | both in |
| $[a, b)$ | $a \le x < b$ | only $a$ in |
| $(a, b]$ | $a < x \le b$ | only $b$ in |

- NCERT calls $(a, b)$ open and $[a, b]$ closed. For $[a, b)$ and $(a, b]$ it says "open interval from $a$ to $b$, including $a$" (or $b$). Many books call these **half-open**.
- Infinity always gets a round bracket: $[0, \infty)$ = non-negative reals, $(-\infty, 0)$ = negative reals, $(-\infty, \infty) = \mathbf{R}$.
- Length of each of the four intervals $= b - a$.

## 8. Universal set and Venn diagrams

- The **universal set** $U$ is the basic set in a given context; all the other sets are its subsets. It is not unique: for the integers, $U$ could be $\mathbf{Q}$ or $\mathbf{R}$.
- A **Venn diagram** shows $U$ as a rectangle and its subsets as circles inside it.

## 9. Union, intersection, difference

| Operation | Elements | Venn shading |
|---|---|---|
| $A \cup B$ | in $A$ or $B$ (or both) | both circles |
| $A \cap B$ | in both | the overlap |
| $A - B$ | in $A$, not in $B$ | $A$ without the overlap |

- If $B \subset A$, then $A \cup B = A$ and $A \cap B = B$.
- $A$ and $B$ are **disjoint** if $A \cap B = \phi$: $\{2, 4, 6, 8\}$ and $\{1, 3, 5, 7\}$.
- $A - B$, $A \cap B$ and $B - A$ are **mutually disjoint**, and together they make up $A \cup B$.

:::example{title="Difference is not symmetric"}
$A = \{1, 2, 3, 4, 5, 6\}$, $B = \{2, 4, 6, 8\}$: $A - B = \{1, 3, 5\}$ but $B - A = \{8\}$.
:::

## 10. Complement and De Morgan's laws

- $A' = U - A$: everything in $U$ that is not in $A$. It depends on $U$.
- $A \cup A' = U$, $A \cap A' = \phi$, $(A')' = A$, $\phi' = U$, $U' = \phi$.
- **De Morgan:** $(A \cup B)' = A' \cap B'$ and $(A \cap B)' = A' \cup B'$. The complement of a union is the intersection of the complements, and the other way round.

:::example{title="Checking De Morgan"}
$U = \{1, \dots, 6\}$, $A = \{2, 3\}$, $B = \{3, 4, 5\}$. Then $A \cup B = \{2, 3, 4, 5\}$, so $(A \cup B)' = \{1, 6\}$. Also $A' = \{1, 4, 5, 6\}$ and $B' = \{1, 2, 6\}$, so $A' \cap B' = \{1, 6\}$. They match.
:::

## 11. Power set (exam extra: in the JEE Main syllabus, not in NCERT)

- The **power set** $P(A)$ is the set of all subsets of $A$. If $n(A) = m$, then $n(P(A)) = 2^m$.
- Each element is either in a subset or not: 2 choices each, so $2^m$ subsets.
- Example: $P(\{a, b\}) = \{\phi, \{a\}, \{b\}, \{a, b\}\}$.

## 12. Counting elements (exam extra, not in NCERT)

These were in older NCERT books but are not in the current one (reprint 2025-26). The JEE Main syllabus does not name them, but its questions on union and intersection use them often.

- $n(A \cup B) = n(A) + n(B) - n(A \cap B)$: the overlap is counted twice, so subtract it once.
- "Only $A$" $= n(A) - n(A \cap B)$. "Neither" $= n(U) - n(A \cup B)$.
- For three sets, add the three, subtract the three pairwise overlaps, add back the triple overlap.

:::example{title="Two sets"}
Of 50 students, 30 like tea, 25 like coffee and 10 like both. Tea or coffee: $30 + 25 - 10 = 45$. Neither: $50 - 45 = 5$. Only tea: $30 - 10 = 20$.
:::
