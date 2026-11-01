---
title: "Matrices: Quick Practice"
type: practice
chapter: c12.mathematics.matrices
order: 4
---

Try each question first, then tap **Show answer**.

## Order and equality

:::question{title="1. Possible orders" exam="JEE Main level"}
A matrix has 36 elements. How many different orders can it have?

---

The order $m \times n$ needs $mn = 36$. The divisors of 36 are 1, 2, 3, 4, 6, 9, 12, 18, 36, and each one gives a value of $m$ (with $n = 36/m$).

So there are **9 orders**: $1 \times 36$, $2 \times 18$, $3 \times 12$, $4 \times 9$, $6 \times 6$, $9 \times 4$, $12 \times 3$, $18 \times 2$, $36 \times 1$.
:::

:::question{title="2. Matrix from a rule" exam="JEE Main level"}
Construct the $2 \times 3$ matrix $A = [a_{ij}]$ with $a_{ij} = |2i - 3j|$.

---

Row 1 ($i = 1$): $|2 - 3| = 1$, $|2 - 6| = 4$, $|2 - 9| = 7$.

Row 2 ($i = 2$): $|4 - 3| = 1$, $|4 - 6| = 2$, $|4 - 9| = 5$.

**Answer:**
$$A = \begin{bmatrix} 1 & 4 & 7 \\ 1 & 2 & 5 \end{bmatrix}$$
:::

:::question{title="3. Equal matrices" exam="JEE Main level"}
$$\begin{aligned} &2\begin{bmatrix} x & 3 \\ 1 & y \end{bmatrix} + \begin{bmatrix} 1 & -2 \\ 0 & 3 \end{bmatrix} \\ &= \begin{bmatrix} 7 & 4 \\ 2 & 9 \end{bmatrix} \end{aligned}$$
Find $x + y$.

---

Left side $= \begin{bmatrix} 2x + 1 & 4 \\ 2 & 2y + 3 \end{bmatrix}$. Compare elements: $2x + 1 = 7$ gives $x = 3$; $2y + 3 = 9$ gives $y = 3$.

$x + y =$ **6**.
:::

## Algebra of matrices

:::question{title="4. Two unknown matrices" exam="JEE Main level"}
Find $X$ and $Y$ if
$$2X + Y = \begin{bmatrix} 5 & 0 \\ 3 & 4 \end{bmatrix}$$
$$X + 2Y = \begin{bmatrix} 4 & 3 \\ 3 & 5 \end{bmatrix}$$

---

Adding: $3(X + Y) = \begin{bmatrix} 9 & 3 \\ 6 & 9 \end{bmatrix}$, so $X + Y = \begin{bmatrix} 3 & 1 \\ 2 & 3 \end{bmatrix}$.

Subtracting: $X - Y = \begin{bmatrix} 1 & -3 \\ 0 & -1 \end{bmatrix}$.

So $X = \tfrac12\big[(X + Y) + (X - Y)\big]$ and $Y = \tfrac12\big[(X + Y) - (X - Y)\big]$.

**Answer:**
$$X = \begin{bmatrix} 2 & -1 \\ 1 & 1 \end{bmatrix}$$
$$Y = \begin{bmatrix} 1 & 2 \\ 1 & 2 \end{bmatrix}$$
:::

:::question{title="5. Square of a sum" exam="JEE Main level"}
$$A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$$
$$B = \begin{bmatrix} 2 & 0 \\ 1 & -1 \end{bmatrix}$$
Find $(A + B)^2 - (A^2 + 2AB + B^2)$.

---

$(A + B)^2 = A^2 + AB + BA + B^2$, so the difference is $BA - AB$.

$AB = \begin{bmatrix} 4 & -2 \\ 10 & -4 \end{bmatrix}$ and $BA = \begin{bmatrix} 2 & 4 \\ -2 & -2 \end{bmatrix}$.

$$BA - AB = \begin{bmatrix} -2 & 6 \\ -12 & 2 \end{bmatrix}$$
The answer is **this matrix**, not $O$, because $AB \ne BA$.
:::

:::question{title="6. A matrix equation and the inverse" exam="JEE Main level"}
$$A = \begin{bmatrix} 2 & 1 \\ 1 & 3 \end{bmatrix}$$
Find $k$ such that $A^2 - 5A + kI = O$. Hence find $A^{-1}$.

---

$A^2 = \begin{bmatrix} 5 & 5 \\ 5 & 10 \end{bmatrix}$, so $A^2 - 5A = \begin{bmatrix} -5 & 0 \\ 0 & -5 \end{bmatrix} = -5I$. Hence **$k = 5$**.

Then $A(5I - A) = 5I$, and $(5I - A)A = 5I$ as well. So
$$A^{-1} = \tfrac15(5I - A) = \tfrac15\begin{bmatrix} 3 & -1 \\ -1 & 2 \end{bmatrix}$$
:::

:::question{title="7. Idempotent matrix" exam="JEE Main level"}
$A$ is a non-zero square matrix with $A^2 = A$. If $(I + A)^4 = I + kA$, find $k$.

---

$I$ and $A$ commute, so expand like a binomial. Every power $A^r = A$:
$$(I + A)^4 = I + (4 + 6 + 4 + 1)A$$
So **$k = 15$** (that is, $2^4 - 1$).
(If $A = O$ were allowed, every $k$ would work.)
:::

## Transpose, symmetric and inverse

:::question{title="8. Skew symmetric" exam="JEE Main level"}
$$A = \begin{bmatrix} 0 & a & 3 \\ 2 & b & -1 \\ c & 1 & 0 \end{bmatrix}$$
is skew symmetric. Find $a + b + c$.

---

Skew symmetric means $a_{ji} = -a_{ij}$ and a zero diagonal.

$a = -a_{21} = -2$; $b$ is on the diagonal, so $b = 0$; $c = -a_{13} = -3$. (Check: $a_{32} = 1 = -a_{23}$.)

$a + b + c =$ **−5**.
:::

:::question{title="9. Symmetric + skew symmetric" exam="JEE Main level"}
Write $A = \begin{bmatrix} 4 & 7 \\ -1 & 2 \end{bmatrix}$ as $P + Q$, with $P$ symmetric and $Q$ skew symmetric.

---

$A' = \begin{bmatrix} 4 & -1 \\ 7 & 2 \end{bmatrix}$.

**Answer:**
$$P = \tfrac12(A + A') = \begin{bmatrix} 4 & 3 \\ 3 & 2 \end{bmatrix}$$
$$Q = \tfrac12(A - A') = \begin{bmatrix} 0 & 4 \\ -4 & 0 \end{bmatrix}$$
Check: $P + Q = A$, $P' = P$, $Q' = -Q$.
:::

:::question{title="10. Inverse of a product" exam="JEE Main level"}
$A$ and $B$ are invertible $2 \times 2$ matrices with
$$A^{-1} = \begin{bmatrix} 1 & 2 \\ 0 & 1 \end{bmatrix}$$
$$B^{-1} = \begin{bmatrix} 1 & 0 \\ 3 & 1 \end{bmatrix}$$
Find $(AB)^{-1}$.

---

$(AB)^{-1} = B^{-1}A^{-1}$ (order reversed):
$$\begin{aligned} &\begin{bmatrix} 1 & 0 \\ 3 & 1 \end{bmatrix}\begin{bmatrix} 1 & 2 \\ 0 & 1 \end{bmatrix} \\ &= \begin{bmatrix} 1 & 2 \\ 3 & 7 \end{bmatrix} \end{aligned}$$
The answer is **this matrix**. The wrong order $A^{-1}B^{-1}$ gives $\begin{bmatrix} 7 & 2 \\ 3 & 1 \end{bmatrix}$.
:::
