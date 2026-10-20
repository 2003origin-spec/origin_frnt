---
title: "Relations and Functions (Class 12): Important Points and Traps"
type: key_points
chapter: c12.mathematics.relations-and-functions
order: 3
---

## Types of relations

:::remember
- **Reflexive:** $(a, a) \in R$ for every $a$. **Symmetric:** $a\,R\,b \Rightarrow b\,R\,a$. **Transitive:** $a\,R\,b$, $b\,R\,c \Rightarrow a\,R\,c$.
- **Equivalence** = all three.
- Empty relation $\phi$ and universal relation $A \times A$ are the **trivial** relations.
:::

:::trap
**Reflexive means every element.** In $A = \{1, 2, 3\}$, the relation $\{(1, 1), (2, 2)\}$ is **not** reflexive, because $(3, 3)$ is missing.
:::

:::trap
**The empty relation** on a non-empty set is symmetric and transitive (there is no pair to break the rule), but **not reflexive**. The universal relation is an equivalence relation.
:::

:::trap
**Transitivity with repeated elements.** In $\{1, 2, 3\}$, $R = \{(1, 2), (2, 1)\}$ is **not** transitive: $(1, 2)$ and $(2, 1)$ need $(1, 1)$. Always try $a_3 = a_1$ too.
:::

:::trap
**"Symmetric + transitive ⇒ reflexive" is false.** From $(a, b)$ and $(b, a)$ you get $(a, a)$ only for elements that are related to something. In $\{1, 2\}$, $\{(1, 1)\}$ is symmetric and transitive but not reflexive, since $(2, 2)$ is missing.
:::

- **One counterexample** is enough to show a property fails. A proof that it holds must cover **all** elements.
- To show a relation is **not** transitive, give three elements: $(a, b) \in R$, $(b, c) \in R$, $(a, c) \notin R$.

## Relations NCERT uses

| Relation | Type |
|---|---|
| congruent, similar | equivalence |
| parallel lines | equivalence |
| perpendicular lines | symmetric only |
| $a \le b$ on $\mathbf{R}$ | reflexive, transitive |
| $A \subset B$ on $P(X)$ | reflexive, transitive |
| $a \le b^2$ on $\mathbf{R}$ | none of the three |

:::trap
NCERT counts a line as **parallel to itself**, so "is parallel to" is reflexive and an equivalence relation. If a question says "parallel and distinct", it is not reflexive.
:::

- In NCERT, $A \subset B$ includes $A = B$. It is not symmetric: $\phi \subset X$ but $X \not\subset \phi$ when $X$ is non-empty.
- $a \le b^2$ fails all three: $\frac12 \not\le \frac14$; $(1, 2)$ in but $(2, 1)$ not; $3 \le (-2)^2$ and $-2 \le 1^2$ but $3 \not\le 1^2$.

## Equivalence classes

:::remember
- Two equivalence classes are either the **same** or **disjoint**. They never partly overlap.
- $[a] = [b]$ exactly when $a\,R\,b$.
- "$a - b$ divisible by $m$" on $\mathbf{Z}$ gives exactly $m$ classes: $[0], [1], \dots, [m - 1]$.
:::

:::trap
The **intersection** of two equivalence relations is an equivalence relation (NCERT), but the **union** need not be (exam extra). In $\{1, 2, 3\}$, take classes $\{1, 2\}, \{3\}$ and $\{1\}, \{2, 3\}$. The union contains $(1, 2)$ and $(2, 3)$ but not $(1, 3)$.
:::

:::tip
To **count equivalence relations**, count the ways to split the set into groups. 3 elements: 5 ways. 4 elements: 15 ways. If a pair such as $(1, 2)$ must be in $R$, glue 1 and 2 into one block first.
:::

## One-one and onto

:::remember
- One-one: $f(x_1) = f(x_2) \Rightarrow x_1 = x_2$. Onto: range = codomain.
- An invertible function is the same as a bijective one.
- For a finite set $X$: $f : X \to X$ is one-one **if and only if** it is onto. Not true for infinite sets.
:::

:::trap
**The sets matter as much as the rule.** $x^2$ is one-one on $\mathbf{N}$ but not on $\mathbf{Z}$ or $\mathbf{R}$. $2x$ is onto from $\mathbf{R}$ to $\mathbf{R}$ but not from $\mathbf{N}$ to $\mathbf{N}$. Read the domain and codomain first.
:::

:::trap
**Onto is about the codomain, not "all real numbers".** $f(x) = x^2$ from $\mathbf{R}$ to $[0, \infty)$ is onto, but from $\mathbf{R}$ to $\mathbf{R}$ it is not.
:::

:::trap
When proving onto, check that the preimage you find is **in the domain**. For $f(x) = 2x$ on $\mathbf{N}$, $y = 3$ gives $x = 1.5 \notin \mathbf{N}$, so it is not onto.
:::

- Sum of two onto functions need not be onto; sum of two one-one functions need not be one-one (NCERT Examples 25 and 26).

:::tip
(Exam extra) A **strictly increasing** or **strictly decreasing** function is one-one. On a graph: $f$ is one-one if no horizontal line cuts it more than once.
:::

## Counting (exam extra)

For $n(A) = p$, $n(B) = q$:
- functions: $q^p$; one-one: $q(q - 1)\cdots(q - p + 1)$ if $p \le q$, else 0;
- bijections only when $p = q$: $p!$ (this case is in NCERT);
- onto into 2 elements: $2^p - 2$ (remove the 2 constant functions).

:::trap
Count onto functions by **inclusion–exclusion**, not by "choose images, then arrange the rest", which counts some functions twice. $\{1, 2, 3, 4\} \to \{a, b, c\}$: $81 - 3(16) + 3(1) = 36$.
:::

## Composition and inverse

:::trap
$g \circ f$ means **$f$ first, then $g$**: $(g \circ f)(x) = g(f(x))$. Usually $g \circ f \ne f \circ g$.
:::

:::trap
$f^{-1}(x)$ is the **inverse function**, not $\dfrac{1}{f(x)}$. And $f^{-1}$ exists only if $f$ is one-one **and** onto. $x^2$ on $\mathbf{R}$ has no inverse; on $[0, \infty) \to [0, \infty)$ its inverse is $\sqrt{x}$.
:::

:::tip
(Exam extra) $(g \circ f)^{-1} = f^{-1} \circ g^{-1}$: "socks and shoes". You put socks on first, but take shoes off first.
:::
