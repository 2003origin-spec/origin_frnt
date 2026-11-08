---
title: "Determinants: Quick Practice"
type: practice
chapter: c12.mathematics.determinants
order: 4
---

Try each question first, then tap **Show answer**.

## Evaluating determinants

:::question{title="1. Use the zeros" exam="JEE Main level"}
Evaluate $\Delta = \begin{vmatrix} 3 & 0 & 2 \\ 1 & 0 & -4 \\ 5 & 6 & 7 \end{vmatrix}$.

---

Expand along column 2. Only $a_{32} = 6$ is non-zero, and its sign is $(-1)^{3+2} = -1$.

$\Delta = -6\begin{vmatrix} 3 & 2 \\ 1 & -4 \end{vmatrix} = -6(-12 - 2) =$ **84**.
:::

:::question{title="2. Scalar and adjoint" exam="JEE Main level"}
$A$ is a 3 × 3 matrix with $|A| = -2$. Find $|3\operatorname{adj} A|$.

---

$|\operatorname{adj} A| = |A|^{3-1} = (-2)^2 = 4$. Then $|3\operatorname{adj} A| = 3^3 \times 4 =$ **108**.
:::

:::question{title="3. Spot the zero (exam extra)" exam="JEE Main level"}
Find the value of $\begin{vmatrix} 1 & a & b+c \\ 1 & b & c+a \\ 1 & c & a+b \end{vmatrix}$.

---

$C_3 \to C_3 + C_2$ makes every entry of column 3 equal to $a + b + c$. Take it out as a factor: columns 1 and 3 are then both all 1s, so the determinant is **0**.
:::

## Area of a triangle

:::question{title="4. Unknown vertex" exam="JEE Main level"}
The triangle with vertices $(k, 0)$, $(3, 2)$ and $(1, 4)$ has area 4 square units. Find $k$.

---

$\Delta = \dfrac12\begin{vmatrix} k & 0 & 1 \\ 3 & 2 & 1 \\ 1 & 4 & 1 \end{vmatrix}$. Expand along row 1:

$\Delta = \dfrac12\left[k(2 - 4) + 1(12 - 2)\right] = 5 - k$

$5 - k = \pm 4$, so **$k = 1$ or $k = 9$**.
:::

## Cofactors, adjoint and inverse

:::question{title="5. Cofactor sums" exam="JEE Main level"}
For $A = \begin{bmatrix} 1 & 2 & 0 \\ -1 & 3 & 1 \\ 2 & 0 & 4 \end{bmatrix}$, find
$$\begin{aligned} &a_{11}A_{11} + a_{12}A_{12} + a_{13}A_{13} \\ &+ a_{11}A_{21} + a_{12}A_{22} + a_{13}A_{23} \end{aligned}$$
where $A_{ij}$ is the cofactor of $a_{ij}$.

---

The first three terms are row 1 × its own cofactors, which is $|A| = 1(12 - 0) - 2(-4 - 2) + 0 = 24$.

The last three are row 1 × the cofactors of row 2, which add to 0.

Total: **24**.
:::

:::question{title="6. One entry of the inverse" exam="JEE Main level"}
For $A = \begin{bmatrix} 1 & 2 & 1 \\ 0 & 1 & 3 \\ 2 & 1 & 0 \end{bmatrix}$, find the entry in row 2, column 3 of $A^{-1}$.

---

$|A| = 1(0 - 3) - 2(0 - 6) + 1(0 - 2) = 7$.

Because $\operatorname{adj} A$ is a transpose, the $(2, 3)$ entry of $A^{-1}$ is $\dfrac{A_{32}}{|A|}$.

$M_{32} = \begin{vmatrix} 1 & 1 \\ 0 & 3 \end{vmatrix} = 3$, so $A_{32} = (-1)^{5}(3) = -3$. The entry is **$-\dfrac37$**.

(Using $A_{23}$ by mistake gives $+\dfrac37$.)
:::

:::question{title="7. Inverse without cofactors" exam="JEE Main level"}
For $A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$, show that $A^2 - 5A - 2I = O$ and use it to find $A^{-1}$.

---

$A^2 = \begin{bmatrix} 7 & 10 \\ 15 & 22 \end{bmatrix}$ and $5A = \begin{bmatrix} 5 & 10 \\ 15 & 20 \end{bmatrix}$, so $A^2 - 5A = 2I$.

$|A| = -2 \ne 0$. Multiply $A^2 - 5A - 2I = O$ by $A^{-1}$: $A - 5I - 2A^{-1} = O$.

$A^{-1} = \dfrac12(A - 5I) =$ **$\begin{bmatrix} -2 & 1 \\ \frac32 & -\frac12 \end{bmatrix}$**
:::

## Systems of equations

:::question{title="8. Matrix method" exam="JEE Main level"}
Solve by the matrix method: $x + y + z = 4$, $2x - y + z = 8$, $x + 2y - z = -3$.

---

$|A| = 1(1 - 2) - 1(-2 - 1) + 1(4 + 1) = 7 \ne 0$, so the solution is unique.

Cofactors: $A_{11} = -1$, $A_{12} = 3$, $A_{13} = 5$, $A_{21} = 3$, $A_{22} = -2$, $A_{23} = -1$, $A_{31} = 2$, $A_{32} = 1$, $A_{33} = -3$.

$X = \dfrac17\begin{bmatrix} -1 & 3 & 2 \\ 3 & -2 & 1 \\ 5 & -1 & -3 \end{bmatrix}\begin{bmatrix} 4 \\ 8 \\ -3 \end{bmatrix} = \dfrac17\begin{bmatrix} 14 \\ -7 \\ 21 \end{bmatrix}$

So **$x = 2$, $y = -1$, $z = 3$**.
:::

:::question{title="9. Infinitely many solutions" exam="JEE Main level"}
The system $x + y + z = 1$, $x + 2y + 3z = 2$, $x + 3y + \lambda z = \mu$ has infinitely many solutions. Find $\lambda + \mu$.

---

$|A| = 1(2\lambda - 9) - 1(\lambda - 3) + 1(3 - 2) = \lambda - 5$. A unique solution would need $\lambda \ne 5$, so $\lambda = 5$.

Subtract: (eq 2) − (eq 1) gives $y + 2z = 1$; (eq 3) − (eq 2) gives $y + 2z = \mu - 2$.

These agree only if $\mu - 2 = 1$, so $\mu = 3$. Then there are infinitely many solutions (for $\mu \ne 3$, none).

$\lambda + \mu =$ **8**.
:::

:::question{title="10. Non-zero solution (exam extra)" exam="JEE Main level"}
Find all $k$ for which $kx + y + z = 0$, $x + ky + z = 0$, $x + y + kz = 0$ has a solution other than $x = y = z = 0$.

---

A homogeneous system (square $A$) has a non-zero solution exactly when $|A| = 0$:

$k(k^2 - 1) - 1(k - 1) + 1(1 - k) = k^3 - 3k + 2 = (k - 1)^2(k + 2)$

So **$k = 1$ or $k = -2$**.
:::
