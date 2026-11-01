---
title: "Matrices: Important Points and Traps"
type: key_points
chapter: c12.mathematics.matrices
order: 3
---

## Orders and types

:::remember
- An $m \times n$ matrix has $mn$ elements. "$m \times n$" is rows first, then columns.
- The number of possible orders of a matrix with $N$ elements = the number of divisors of $N$. (8 elements: $1 \times 8$, $8 \times 1$, $2 \times 4$, $4 \times 2$.)
- Every identity matrix is a scalar matrix; every scalar matrix is a diagonal matrix; every diagonal matrix is square.
- A zero matrix can have any order. A diagonal, scalar or identity matrix must be square.
:::

:::trap
$[1 \ \ 2]$ and $\begin{bmatrix} 1 \\ 2 \end{bmatrix}$ are **not** equal: the orders differ ($1 \times 2$ and $2 \times 1$). Equal matrices need the same order first, then equal elements in every position.
:::

## Multiplication

:::trap
**$AB$ defined does not mean $BA$ is defined.** $A$: $2 \times 3$, $B$: $3 \times 4$ gives $AB$ ($2 \times 4$), but $BA$ is not defined. Always check "columns of the first = rows of the second".
:::

:::trap
**$AB \ne BA$ in general.** So
$$(A + B)^2 = A^2 + AB + BA + B^2$$
$$(A + B)(A - B) = A^2 - AB + BA - B^2$$
The school formulas $A^2 + 2AB + B^2$ and $A^2 - B^2$ hold **only** when $AB = BA$.
:::

:::trap
**$AB = O$ does not mean $A = O$ or $B = O$.** Two non-zero matrices can multiply to $O$.

For the same reason you **cannot cancel**: $AB = AC$ does not give $B = C$ (unless $A$ is invertible, when you can multiply both sides by $A^{-1}$).
:::

:::trap
**$A^2 = I$ does not mean $A = \pm I$.** For example $\begin{bmatrix} 0 & 1 \\ 1 & 0 \end{bmatrix}$ and $\begin{bmatrix} 1 & 0 \\ 0 & -1 \end{bmatrix}$ both square to $I$.
:::

- Order of a product: $(m \times n)(n \times p) = m \times p$. The inner numbers must match; the outer numbers give the answer.
- $I$ and $O$ commute with every square matrix of the same order, and so does every scalar matrix $kI$.
- In a matrix polynomial the constant term carries $I$: $A^2 - 5A + 7I$.

:::tip
Since $I$ commutes with everything, $(I + A)^n$ expands like a binomial. If $A^2 = A$, every power $A^r = A$, so
$$(I + A)^n = I + (2^n - 1)A$$
(The coefficients ${}^nC_1 + {}^nC_2 + \cdots + {}^nC_n$ add up to $2^n - 1$.)
:::

:::tip
Useful powers (check $n = 2, 3$ and spot the pattern):
$$\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}^n = \begin{bmatrix} 1 & n \\ 0 & 1 \end{bmatrix}$$
$$\begin{bmatrix} a & 0 \\ 0 & b \end{bmatrix}^n = \begin{bmatrix} a^n & 0 \\ 0 & b^n \end{bmatrix}$$
The rotation-type matrix of NCERT Example 23 turns $\theta$ into $n\theta$.
:::

## Transpose

:::trap
**Order reverses:** $(AB)' = B'A'$, not $A'B'$. ($A'B'$ may not even be defined.) The same reversal happens for inverses: $(AB)^{-1} = B^{-1}A^{-1}$.
:::

- $(A')' = A$, $(kA)' = kA'$, $(A + B)' = A' + B'$.
- If $A$ is $m \times n$, then $AA'$ ($m \times m$) and $A'A$ ($n \times n$) are always defined and both are **symmetric**.

## Symmetric and skew symmetric

:::remember
- Symmetric: $A' = A$. Skew symmetric: $A' = -A$, so every diagonal element is **0**.
- A matrix that is both symmetric and skew symmetric is the **zero matrix** ($A = -A$ gives $A = O$).
- $A + A'$ is symmetric; $A - A'$ is skew symmetric (for square $A$).
- If $A$, $B$ are symmetric of the same order: $AB - BA$ is skew symmetric, $AB + BA$ is symmetric, and $AB$ is symmetric **if and only if** $AB = BA$.
- $B'AB$ is symmetric or skew symmetric according as $A$ is symmetric or skew symmetric.
:::

:::trap
Splitting $A$ into symmetric and skew parts uses $\tfrac12$: the parts are $\tfrac12(A + A')$ and $\tfrac12(A - A')$. Forgetting the $\tfrac12$ gives two matrices that add up to $2A$.
:::

:::tip
Fast check of a split: the symmetric part keeps the diagonal of $A$, and each off-diagonal pair becomes the **average** of $a_{ij}$ and $a_{ji}$. The skew part has a zero diagonal and **half the difference** $\tfrac12(a_{ij} - a_{ji})$.
:::

## Inverse

:::remember
- Only square matrices can have an inverse, and not every square matrix has one.
- $AB = BA = I$ means $B = A^{-1}$ and $A = B^{-1}$. The inverse is unique.
- If $A^2 - 5A + 7I = O$, then $A(5I - A) = 7I$, so $A^{-1} = \tfrac17(5I - A)$. A relation like this gives the inverse without determinants.
:::

## Exam extras (in the JEE Main syllabus, not in NCERT Chapter 3)

- For square $A$, $B$ of the same order, $\operatorname{tr}(AB) = \operatorname{tr}(BA)$, so $AB - BA$ always has trace 0. Hence $AB - BA = I$ is impossible.
- For a $2 \times 2$ matrix $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$, $A^2 = (\operatorname{tr} A)A - (ad - bc)I$.
- Orthogonal $A$ ($AA' = I$): $A^{-1} = A'$. The rotation-type matrix is orthogonal.
- Counting: with each element from $\{0, 1\}$ there are $2^{mn}$ matrices of order $m \times n$ (NCERT Exercise 3.1 asks the $3 \times 3$ case: 512), and $2^{n(n+1)/2}$ symmetric ones of order $n$ (the exam extra).
