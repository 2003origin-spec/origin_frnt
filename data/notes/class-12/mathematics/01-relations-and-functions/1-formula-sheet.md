---
title: "Relations and Functions (Class 12): Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.relations-and-functions
order: 1
---

Symbols as in NCERT: $\mathbf{N}$ = natural numbers $\{1, 2, 3, \dots\}$, $\mathbf{Z}$ = integers, $\mathbf{R}$ = real numbers, $\phi$ = empty set, $n(A)$ = number of elements of a finite set $A$.

## Relations in a set

:::formula{title="Relation in a set A"}
$$R \subseteq A \times A$$
If $(a, b) \in R$, we write $a\,R\,b$ and say "$a$ is related to $b$".

On a set with $n$ elements there are $2^{n^2}$ relations (the Class 11 result $2^{pq}$ with $p = q = n$).
:::

:::formula{title="Empty and universal relation"}
$$\text{Empty: } R = \phi$$
$$\text{Universal: } R = A \times A$$
Both are called **trivial** relations.
:::

## Types of relations

For a relation $R$ in a set $A$:

:::formula{title="Reflexive"}
$$(a, a) \in R \ \text{ for every } a \in A$$
Every element must be related to itself. One missing $(a, a)$ breaks it.
:::

:::formula{title="Symmetric"}
$$(a_1, a_2) \in R \Rightarrow (a_2, a_1) \in R$$
For all $a_1, a_2 \in A$.
:::

:::formula{title="Transitive"}
$$\begin{aligned} &(a_1, a_2) \in R \text{ and } (a_2, a_3) \in R \\ &\Rightarrow (a_1, a_3) \in R \end{aligned}$$
For all $a_1, a_2, a_3 \in A$. The three need not be different: $(1, 2), (2, 1) \in R$ forces $(1, 1) \in R$.
:::

:::formula{title="Equivalence relation"}
$$\begin{aligned} &\text{reflexive} + \text{symmetric} \\ &+ \text{transitive} \end{aligned}$$
All three together.
:::

## Equivalence classes

:::formula{title="Equivalence class of a"}
$$[a] = \{b \in X : b\,R\,a\}$$
For an equivalence relation $R$ in $X$: the set of all elements related to $a$. Because $R$ is symmetric, "$b\,R\,a$" and "$a\,R\,b$" mean the same.
:::

:::formula{title="Classes form a partition"}
$$[a] = [b] \iff a\,R\,b$$
- Two classes are either **equal** or **disjoint**.
- The union of all the classes is $X$.
- Every element lies in exactly one class.
:::

:::formula{title="Same remainder on division by m"}
$$a\,R\,b \iff m \text{ divides } a - b$$
For a positive integer $m$, this is an equivalence relation on $\mathbf{Z}$ with exactly $m$ classes: $[0], [1], \dots, [m-1]$. NCERT does $m = 2$ (even, odd) and $m = 3$.
:::

## Counting relations (exam extra)

Not in NCERT, but often asked in JEE Main. For a set with $n$ elements:

:::formula{title="Reflexive relations"}
$$2^{\,n^2 - n}$$
The $n$ pairs $(a, a)$ must be in; each of the other $n^2 - n$ pairs is in or out.
:::

:::formula{title="Symmetric relations"}
$$2^{\,n(n+1)/2}$$
Choose freely for the $n$ pairs $(a, a)$ and the $\frac{n(n-1)}{2}$ couples $\{(a, b), (b, a)\}$ with $a \ne b$ (each couple is fully in or fully out).
:::

:::formula{title="Reflexive and symmetric"}
$$2^{\,n(n-1)/2}$$
Only the $\frac{n(n-1)}{2}$ couples $\{(a, b), (b, a)\}$ with $a \ne b$ are free.
:::

:::formula{title="Equivalence relations"}
$$\begin{aligned} &\text{equivalence relations} \\ &= \text{partitions of } A \end{aligned}$$
The number of equivalence relations equals the number of ways to split $A$ into non-empty groups (partitions).

For $n = 1, 2, 3, 4$: **1, 2, 5, 15**. There is no simple formula; for small sets, list the partitions.
:::

## Types of functions

For $f : X \to Y$:

:::formula{title="One-one (injective)"}
$$f(x_1) = f(x_2) \Rightarrow x_1 = x_2$$
For all $x_1, x_2 \in X$: different inputs give different images. Otherwise $f$ is **many-one**.
:::

:::formula{title="Onto (surjective)"}
$$\text{Range of } f = Y$$
Every $y \in Y$ has some $x \in X$ with $f(x) = y$. A function that is not onto is called **into** (exam term from the JEE Main syllabus; NCERT just says "not onto").
:::

:::formula{title="Bijective"}
$$\text{bijective} = \text{one-one} + \text{onto}$$
:::

:::formula{title="Finite set: one-one ⇔ onto"}
$$f : X \to X,\ X \text{ finite}$$
Then $f$ is one-one exactly when it is onto. This fails for infinite sets: $f(x) = 2x$ on $\mathbf{N}$ is one-one but not onto.
:::

## Counting functions

For finite sets with $n(A) = p$ and $n(B) = q$:

:::formula{title="All functions (exam extra)"}
$$q^{\,p}$$
Each of the $p$ elements picks one of $q$ images.
:::

:::formula{title="One-one functions (exam extra)"}
$$\frac{q!}{(q - p)!} \quad (p \le q)$$
If $p > q$, there are none.
:::

:::formula{title="Bijections"}
$$n!$$
When $p = q = n$. In NCERT: a one-one function from $\{1, 2, 3\}$ to itself is a permutation, so there are $3! = 6$. If $p \ne q$, there are none.
:::

:::formula{title="Onto functions (exam extra)"}
$$\begin{aligned} &q^p - \binom{q}{1}(q-1)^p \\ &+ \binom{q}{2}(q-2)^p - \cdots \end{aligned}$$
For $p \ge q$ (none if $p < q$). The signs alternate and the last term is $\pm\binom{q}{q-1}1^p$.

Onto a 2-element set: $2^p - 2$.
:::

## Composition of functions

:::formula{title="Composition"}
$$(g \circ f)(x) = g(f(x))$$
For $f : A \to B$ and $g : B \to C$; then $g \circ f : A \to C$. NCERT writes it as **gof**. Apply $f$ first, then $g$.
:::

:::formula{title="Order matters"}
$$g \circ f \ne f \circ g \ \text{ in general}$$
NCERT: $f(x) = \cos x$, $g(x) = 3x^2$ give $3\cos^2 x$ and $\cos(3x^2)$.
:::

:::formula{title="Rules for composition (exam extra)"}
$$h \circ (g \circ f) = (h \circ g) \circ f$$
- $f$, $g$ both one-one $\Rightarrow$ $g \circ f$ one-one.
- $f$, $g$ both onto $\Rightarrow$ $g \circ f$ onto.
- $g \circ f$ one-one $\Rightarrow$ $f$ one-one.
- $g \circ f$ onto $\Rightarrow$ $g$ onto.
:::

## Invertible functions

:::formula{title="Inverse"}
$$g \circ f = I_X$$
$$f \circ g = I_Y$$
$f : X \to Y$ is invertible if such a $g : Y \to X$ exists. Then $g = f^{-1}$. $I_X(x) = x$ is the identity function on $X$.
:::

:::formula{title="When an inverse exists"}
$$f \text{ invertible} \iff f \text{ bijective}$$
:::

:::formula{title="Finding the inverse"}
$$f^{-1}(y) = x \iff f(x) = y$$
For a bijection $f$. Write $y = f(x)$, solve for $x$ in terms of $y$. Check that this $x$ lies in the domain for every $y$ in the codomain.
:::

:::formula{title="Inverse of a composition (exam extra)"}
$$(g \circ f)^{-1} = f^{-1} \circ g^{-1}$$
For bijections $f : X \to Y$ and $g : Y \to Z$. Also $(f^{-1})^{-1} = f$.
:::

## Equal functions

:::formula{title="Equal functions"}
$$f(a) = g(a) \ \text{ for all } a \in A$$
For $f, g : A \to B$ (same domain, same codomain). From the hint in NCERT's Miscellaneous Exercise.
:::
