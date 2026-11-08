---
title: "Determinants: Important Points and Traps"
type: key_points
chapter: c12.mathematics.determinants
order: 3
---

## NCERT one-liners

:::remember
- Only square matrices have determinants. $|A|$ is read "determinant of $A$", not "modulus of $A$".
- Expanding along any row or column gives the same value.
- Entries of a row (or column) × their own cofactors add to $|A|$. × the cofactors of another row (or column) add to 0.
- $A(\operatorname{adj} A) = (\operatorname{adj} A)A = |A|\,I$.
- $A$ is singular if $|A| = 0$ and non-singular if $|A| \ne 0$.
- A square matrix has an inverse **if and only if** it is non-singular.
- The area of a triangle formed by three collinear points is zero.
:::

## Scaling and powers

:::trap
$|kA| = k^n|A|$, **not** $k|A|$. For a 3 × 3 matrix, $|2A| = 8|A|$ and $|-A| = -|A|$.

Multiplying **one row** by $k$ multiplies $\Delta$ by $k$ once. Multiplying the **whole matrix** by $k$ multiplies every row, so $\Delta$ gets $k^n$.
:::

- $|A^m| = |A|^m$ for any positive whole number $m$, from $|AB| = |A|\,|B|$.
- $|A^{-1}| = \dfrac{1}{|A|}$, and $|\operatorname{adj} A| = |A|^{n-1}$ ($= |A|^2$ for order 3).

:::trap
$|A + B| \ne |A| + |B|$ in general. Only products split: $|AB| = |A|\,|B|$.
:::

:::tip
For a scalar-adjoint mix, collect powers. Order 3, $|A| = 3$:
$|2\operatorname{adj} A| = 2^3 \times 3^2 = 72$, and $|A^{-1}\operatorname{adj} A| = \dfrac13 \times 9 = 3$.
:::

## Signs, minors and cofactors

:::trap
The cofactor carries the sign $(-1)^{i+j}$; the minor does not. When you expand along row 2 or column 2, the signs start with **minus**: $-\,+\,-$.
:::

:::tip
Chessboard of signs, starting with $+$ in the top-left corner:
$$\begin{bmatrix} + & - & + \\ - & + & - \\ + & - & + \end{bmatrix}$$
:::

- Pick the row or column with the most zeros. If none has zeros, create them first with $R_i \to R_i + kR_j$ (exam extra property).

## Adjoint and inverse

:::trap
$\operatorname{adj} A$ is the **transpose** of the cofactor matrix. Forgetting the transpose is the most common mistake.

So the $(i, j)$ entry of $A^{-1}$ is $\dfrac{A_{ji}}{|A|}$: note $ji$, not $ij$.
:::

:::trap
The 2 × 2 shortcut (swap the diagonal, change the signs of the other two) does **not** work for 3 × 3 matrices. For order 3, find all nine cofactors.
:::

:::trap
Always check $|A| \ne 0$ **before** writing $A^{-1}$. If $|A| = 0$, there is no inverse, and $X = A^{-1}B$ cannot be used.
:::

- $(AB)^{-1} = B^{-1}A^{-1}$, in reverse order.
- Check your inverse: $AA^{-1}$ must come out as $I$. It costs one row-by-column product.

## Area of a triangle

:::trap
The determinant can be negative; the area is its **absolute value**. When the area is given, set $\frac12 \times$ (determinant) equal to $+$area and to $-$area. Dropping the minus case loses an answer.
:::

- The vertices can be taken in any order: at most the sign of the determinant changes, so the area is the same.

## Consistency of AX = B

:::trap
$|A| = 0$ and $(\operatorname{adj} A)B = O$ does **not** guarantee infinitely many solutions. Example: $x + y + z = 1$, $x + y + z = 2$, $x + y + z = 3$ gives $|A| = 0$ and $(\operatorname{adj} A)B = O$, but the system has **no** solution.

In this case, eliminate and look at the equations themselves.
:::

:::trap
$|A| = 0$ alone does not mean "no solution". It only means "not a unique solution". Then compute $(\operatorname{adj} A)B$.
:::

- If $|A| \ne 0$, the solution is unique, so the system is consistent.
- (Exam extra) The entries of $(\operatorname{adj} A)B$ are Cramer's $\Delta_1, \Delta_2, \Delta_3$. So "$|A| = 0$ and some $\Delta_k \ne 0$" means no solution.
- (Exam extra) $AX = O$ always has the zero solution. A non-zero solution exists only when $|A| = 0$.

## Exam-extra property shortcuts

:::tip
Before expanding, look for:
- two equal or proportional rows or columns: $\Delta = 0$;
- rows that all have the same sum: $C_1 \to C_1 + C_2 + C_3$ makes column 1 constant, and that number comes out as a factor;
- a triangular pattern of zeros: $\Delta$ = product of the diagonal.

A skew-symmetric matrix of odd order (3 × 3) always has $\Delta = 0$.
:::
