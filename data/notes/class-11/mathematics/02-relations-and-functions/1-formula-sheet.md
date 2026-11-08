---
title: "Relations and Functions (Class 11): Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.relations-and-functions
order: 1
---

Symbols as in NCERT: $\mathbf{R}$ = real numbers, $\mathbf{N}$ = natural numbers, $\mathbf{Z}$ = integers, $\mathbf{Q}$ = rational numbers, $\phi$ = empty set, $n(A)$ = number of elements of a finite set $A$.

## Ordered pairs and Cartesian product

:::formula{title="Equal ordered pairs"}
$$(a, b) = (x, y) \iff a = x \text{ and } b = y$$
Order matters: $(a, b) \ne (b, a)$ unless $a = b$.
:::

:::formula{title="Cartesian product"}
$$A \times B = \{(a, b) : a \in A,\ b \in B\}$$
If $A = \phi$ or $B = \phi$, then $A \times B = \phi$.

$\mathbf{R} \times \mathbf{R}$ = all points $(x, y)$ of the plane. $\mathbf{R} \times \mathbf{R} \times \mathbf{R}$ = all points $(x, y, z)$ of space.
:::

:::formula{title="Number of elements"}
$$n(A \times B) = n(A) \cdot n(B) = pq$$
$$n(A \times A \times A) = p^3$$
For finite sets with $n(A) = p$, $n(B) = q$. If $A$ and $B$ are non-empty and either one is infinite, $A \times B$ is infinite.
:::

:::formula{title="Product with intersection and union"}
$$A \times (B \cap C) = (A \times B) \cap (A \times C)$$
$$A \times (B \cup C) = (A \times B) \cup (A \times C)$$
Both are worked or verified in NCERT examples and exercises.
:::

:::formula{title="More product identities (exam extra)"}
$$A \times (B - C) = (A \times B) - (A \times C)$$
$$(A \times B) \cap (C \times D) = (A \cap C) \times (B \cap D)$$
:::

## Relations

:::formula{title="Relation"}
$$R \subseteq A \times B$$
A relation from $A$ to $B$ is any subset of $A \times B$. If $(x, y) \in R$, $y$ is the image of $x$.
- Domain = set of all first elements of the pairs in $R$.
- Range = set of all second elements.
- Codomain = the whole set $B$. Range $\subseteq$ codomain.

A relation from $A$ to $A$ is called a relation on $A$.
:::

:::formula{title="Number of relations"}
$$\text{relations from } A \text{ to } B = 2^{pq}$$
For $n(A) = p$, $n(B) = q$. This counts the empty relation and $A \times B$ itself.

On a set with $n$ elements: $2^{n^2}$ relations.
:::

## Functions

:::formula{title="Function"}
$$f : A \to B$$
$$f(a) = b$$
Every element of $A$ has **one and only one** image in $B$. $b$ is the image of $a$; $a$ is a preimage of $b$.

Domain $= A$, codomain $= B$, range = set of all images $\subseteq B$.
:::

:::formula{title="Number of functions (exam extra)"}
$$\text{functions from } A \text{ to } B = q^{p}$$
For non-empty finite sets with $n(A) = p$, $n(B) = q$: each of the $p$ elements chooses one of $q$ images.
:::

:::formula{title="Linear function"}
$$f(x) = mx + c$$
$m$, $c$ constants, $x \in \mathbf{R}$. Graph: a straight line with slope $m$ and $y$-intercept $c$.
:::

## Standard real functions

:::formula{title="Modulus function"}
$$f(x) = |x| = \begin{cases} x, & x \ge 0 \\ -x, & x < 0 \end{cases}$$
Domain $\mathbf{R}$, range $[0, \infty)$.
:::

:::formula{title="Signum function"}
$$
f(x) = \begin{cases}
1, & x > 0 \\
0, & x = 0 \\
-1, & x < 0
\end{cases}
$$
Domain $\mathbf{R}$, range $\{-1, 0, 1\}$. Many books write it $\text{sgn}\,x$. For $x \ne 0$, $f(x) = \dfrac{|x|}{x}$ (exam extra).
:::

:::formula{title="Greatest integer function"}
$$[x] = n \quad \text{when } n \le x < n + 1$$
$n$ is an integer. Domain $\mathbf{R}$, range $\mathbf{Z}$.

Exam extras, for every real $x$ and integer $k$:
$$x - 1 < [x] \le x$$
$$[x + k] = [x] + k$$
:::

:::formula{title="Polynomial and rational functions"}
$$f(x) = a_0 + a_1 x + \cdots + a_n x^n$$
$n$ is a non-negative integer, $a_0, \dots, a_n \in \mathbf{R}$.

A rational function is $\dfrac{f(x)}{g(x)}$ with $f$, $g$ polynomials, defined only where $g(x) \ne 0$.
:::

## Algebra of real functions

For $f : X \to \mathbf{R}$ and $g : X \to \mathbf{R}$, $X \subseteq \mathbf{R}$, and every $x \in X$:

:::formula{title="Sum and difference"}
$$(f + g)(x) = f(x) + g(x)$$
$$(f - g)(x) = f(x) - g(x)$$
:::

:::formula{title="Scalar multiple and product"}
$$(\alpha f)(x) = \alpha\, f(x)$$
$$(fg)(x) = f(x)\, g(x)$$
$\alpha$ is a real number. The product is "pointwise multiplication".
:::

:::formula{title="Quotient"}
$$\left(\frac{f}{g}\right)(x) = \frac{f(x)}{g(x)}$$
Only where $g(x) \ne 0$.
:::

:::formula{title="Domain when f and g have different domains (exam extra)"}
$$D_{f \pm g} = D_{fg} = D_f \cap D_g$$
$$D_{f/g} = (D_f \cap D_g) - \{x : g(x) = 0\}$$
:::
