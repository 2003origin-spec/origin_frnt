---
title: "Determinants: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.determinants
order: 1
---

## Value of a determinant

Only **square** matrices have a determinant. $|A|$, $\det A$ and $\Delta$ all mean the same number. $|A|$ is read "determinant of $A$", not "modulus of $A$".

:::formula{title="Order 1 and order 2"}
$$|a_{11}| = a_{11}$$
$$\begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc$$
:::

:::formula{title="Order 3 (expanding along R₁)"}
$$\begin{aligned} |A| &= a_{11}(a_{22}a_{33} - a_{23}a_{32}) \\ &\quad - a_{12}(a_{21}a_{33} - a_{23}a_{31}) \\ &\quad + a_{13}(a_{21}a_{32} - a_{22}a_{31}) \end{aligned}$$
Expanding along **any** row or column gives the same value. Each entry $a_{ij}$ gets the sign $(-1)^{i+j}$:
$$\begin{bmatrix} + & - & + \\ - & + & - \\ + & - & + \end{bmatrix}$$
:::

:::formula{title="Scalar multiple"}
$$|kA| = k^n\,|A|$$
$A$ is a square matrix of order $n$, $k$ is a number. For order 3, $|2A| = 8|A|$.
:::

:::formula{title="Product"}
$$|AB| = |A|\,|B|$$
$A$ and $B$ are square matrices of the same order.
:::

## Area of a triangle

:::formula{title="Area from the vertices"}
$$\Delta = \frac12\begin{vmatrix}x_1&y_1&1\\x_2&y_2&1\\x_3&y_3&1\end{vmatrix}$$
Vertices $(x_1, y_1)$, $(x_2, y_2)$, $(x_3, y_3)$. Area $= |\Delta|$ (take the absolute value). If the area is given, use both $+$ and $-$ values of the determinant.
:::

:::formula{title="Collinear points and the line through two points"}
Three points are collinear exactly when
$$\begin{vmatrix}x_1&y_1&1\\x_2&y_2&1\\x_3&y_3&1\end{vmatrix} = 0$$
For the line through two different points $(x_1, y_1)$ and $(x_2, y_2)$, put the general point $(x, y)$ as the third row.
:::

## Minors and cofactors

:::formula{title="Minor and cofactor"}
$$A_{ij} = (-1)^{i+j}\,M_{ij}$$
$M_{ij}$ = minor of $a_{ij}$: the determinant left after deleting row $i$ and column $j$. $A_{ij}$ = cofactor of $a_{ij}$.
:::

:::formula{title="Expansion by cofactors"}
$$|A| = a_{11}A_{11} + a_{12}A_{12} + a_{13}A_{13}$$
The same holds for every row and every column: entries times **their own** cofactors.
:::

:::formula{title="Entries times another row's cofactors"}
$$a_{11}A_{21} + a_{12}A_{22} + a_{13}A_{23} = 0$$
Entries of one row (or column) times the cofactors of a **different** row (or column) always add to 0.
:::

## Adjoint and inverse

:::formula{title="Adjoint"}
$$\operatorname{adj} A = \left[A_{ij}\right]^{T}$$
The transpose of the matrix of cofactors. For order 3:
$$\operatorname{adj} A = \begin{bmatrix} A_{11} & A_{21} & A_{31} \\ A_{12} & A_{22} & A_{32} \\ A_{13} & A_{23} & A_{33} \end{bmatrix}$$
:::

:::formula{title="Adjoint of a 2 × 2 matrix"}
$$\operatorname{adj}\begin{bmatrix} a & b \\ c & d \end{bmatrix} = \begin{bmatrix} d & -b \\ -c & a \end{bmatrix}$$
Swap the diagonal entries, change the sign of the other two. Only for order 2.
:::

:::formula{title="Matrix times its adjoint"}
$$\begin{aligned} A\,(\operatorname{adj} A) &= (\operatorname{adj} A)\,A \\ &= |A|\,I \end{aligned}$$
True for every square matrix, singular or not.
:::

:::formula{title="Determinant of the adjoint"}
$$|\operatorname{adj} A| = |A|^{\,n-1}$$
$n$ = order of $A$ ($n \ge 2$). For order 3, $|\operatorname{adj} A| = |A|^2$.
:::

:::formula{title="Inverse"}
$$A^{-1} = \frac{1}{|A|}\,\operatorname{adj} A$$
Exists **only when** $|A| \ne 0$ (non-singular $A$). If $|A| = 0$, $A$ is singular and has no inverse.
:::

:::formula{title="Inverse of a 2 × 2 matrix"}
$$\begin{aligned} &\begin{bmatrix} a & b \\ c & d \end{bmatrix}^{-1} \\ &= \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix} \end{aligned}$$
For $ad - bc \ne 0$.
:::

:::formula{title="Inverse rules"}
$$(AB)^{-1} = B^{-1}A^{-1}$$
$$|A^{-1}| = \frac{1}{|A|}$$
$$(A^{-1})^{-1} = A$$
$$(\operatorname{adj} A)^{-1} = \operatorname{adj}(A^{-1})$$
For non-singular $A$ and $B$ of the same order. Note the reversed order in the first rule.
:::

## System of linear equations

:::formula{title="Matrix form and matrix method"}
$$AX = B$$
$$X = A^{-1}B \quad (|A| \ne 0)$$
$A$ = coefficient matrix, $X$ = column of unknowns, $B$ = column of constants. When $|A| \ne 0$ the solution is unique.
:::

:::formula{title="Test of consistency (square A)"}
- $|A| \ne 0$: unique solution, consistent.
- $|A| = 0$ and $(\operatorname{adj} A)\,B \ne O$: no solution, inconsistent.
- $|A| = 0$ and $(\operatorname{adj} A)\,B = O$: may be consistent (infinitely many solutions) or inconsistent (none). Check the equations.
:::

## Exam extras (not in the current NCERT book)

None of these is in the rationalised NCERT chapter. They help with JEE Main syllabus topics: evaluation of determinants, adjoint and inverse, and the test of consistency of linear equations.

:::formula{title="Properties of determinants"}
Removed from the rationalised NCERT book and not named in the JEE Main 2026 syllabus, but they are the quickest way to do its "evaluation of determinants" questions.
- $|A^T| = |A|$, so every row rule also works for columns.
- Swapping two rows changes the sign.
- Two equal (or proportional) rows give 0. A row of zeros gives 0.
- A common factor $k$ of one row can be taken outside.
- $R_i \to R_i + kR_j$ ($i \ne j$) does not change the value.
- A row whose entries are sums splits into a sum of two determinants.
- Triangular or diagonal matrix: $|A|$ = product of the diagonal entries.
- Skew-symmetric matrix of odd order: $|A| = 0$.
:::

:::formula{title="More adjoint results"}
$$\operatorname{adj}(AB) = (\operatorname{adj} B)(\operatorname{adj} A)$$
$$\operatorname{adj}(kA) = k^{\,n-1}\operatorname{adj} A$$
$$\operatorname{adj}(\operatorname{adj} A) = |A|^{\,n-2}A$$
$$|\operatorname{adj}(\operatorname{adj} A)| = |A|^{(n-1)^2}$$
For square matrices $A$, $B$ of the same order $n \ge 2$. Also $\operatorname{adj}(A^T) = (\operatorname{adj} A)^T$.
:::

:::formula{title="Cramer's rule (3 variables)"}
$$x = \frac{\Delta_1}{\Delta}$$
$$y = \frac{\Delta_2}{\Delta}$$
$$z = \frac{\Delta_3}{\Delta}$$
For $\Delta = |A| \ne 0$. $\Delta_1$ is $\Delta$ with column 1 replaced by the constants; same for $\Delta_2$, $\Delta_3$. The entries of $(\operatorname{adj} A)\,B$ are exactly $\Delta_1, \Delta_2, \Delta_3$.
:::

:::formula{title="Homogeneous system AX = O"}
Always consistent ($X = O$ is a solution). It has a non-zero solution exactly when $|A| = 0$.
:::
