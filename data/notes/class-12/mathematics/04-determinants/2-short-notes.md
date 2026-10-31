---
title: "Determinants: Short Notes"
type: short_notes
chapter: c12.mathematics.determinants
order: 2
---

NCERT studies determinants of order 1, 2 and 3 only, with real entries. These notes do the same.

## 1. What a determinant is

- Every **square** matrix $A$ has a number attached to it, called its determinant: $|A|$, $\det A$ or $\Delta$. A non-square matrix has no determinant.
- $|A|$ is a number, not a matrix. Here the bars do **not** mean modulus: $|A|$ can be negative.
- Order 1: $|a| = a$. Order 2: $\begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc$ (main diagonal product minus the other diagonal product).

:::example{title="Order 2"}
$\begin{vmatrix} x & x+1 \\ x-1 & x \end{vmatrix} = x^2 - (x^2 - 1) = 1$ for every $x$.
:::

## 2. Expanding a 3 × 3 determinant

- Pick a row (or column). Multiply each entry by $(-1)^{i+j}$ and by the 2 × 2 determinant left when you delete that entry's row and column. Add the three terms.
- All **six** expansions (3 rows, 3 columns) give the same value.
- The signs follow a chessboard: $+\,-\,+$ on row 1, $-\,+\,-$ on row 2, $+\,-\,+$ on row 3.
- Expand along the row or column with the **most zeros**: those terms vanish.

:::example{title="Use the zeros"}
$\begin{vmatrix} 1 & 2 & 4 \\ -1 & 3 & 0 \\ 4 & 1 & 0 \end{vmatrix}$: column 3 has two zeros, so $\Delta = 4\begin{vmatrix} -1 & 3 \\ 4 & 1 \end{vmatrix} = 4(-1 - 12) = -52$.
:::

- **Scalar multiple:** if $A = kB$ and both have order $n$, then $|A| = k^n|B|$. Each of the $n$ rows gives one factor $k$.

## 3. Area of a triangle

- Vertices $(x_1, y_1)$, $(x_2, y_2)$, $(x_3, y_3)$:

$$\Delta = \frac12\begin{vmatrix}x_1&y_1&1\\x_2&y_2&1\\x_3&y_3&1\end{vmatrix}$$

- Area is positive, so take $|\Delta|$.
- If the area is **given**, set the determinant expression equal to $+$area and to $-$area. Usually you get two answers.
- Three points are **collinear** when this determinant is 0 (zero area).
- **Line through two points** $(x_1, y_1)$, $(x_2, y_2)$: write $(x, y)$ as the third vertex and set the determinant to 0.

:::example{title="Line through (1, 3) and (0, 0)"}
$\begin{vmatrix} 0 & 0 & 1 \\ 1 & 3 & 1 \\ x & y & 1 \end{vmatrix} = 0$ gives $y - 3x = 0$, so the line is $y = 3x$.
:::

## 4. Minors and cofactors

- **Minor** $M_{ij}$ of $a_{ij}$: the determinant left after deleting row $i$ and column $j$. For a 3 × 3 determinant, each minor is 2 × 2.
- **Cofactor** $A_{ij} = (-1)^{i+j} M_{ij}$. It equals $M_{ij}$ when $i + j$ is even and $-M_{ij}$ when $i + j$ is odd.
- $|A|$ = sum of (entries of any one row or column) × (their own cofactors):

$$|A| = a_{21}A_{21} + a_{22}A_{22} + a_{23}A_{23}$$

- Entries of one row × cofactors of a **different** row add up to **0**. (It is the expansion of a determinant with two equal rows.)

## 5. Adjoint

- $\operatorname{adj} A$ = **transpose** of the cofactor matrix $[A_{ij}]$. So the cofactors of row 1 go into **column** 1 of $\operatorname{adj} A$.
- For a 2 × 2 matrix: swap $a$ and $d$, change the signs of $b$ and $c$.
- Key theorem (NCERT Theorem 1): $A(\operatorname{adj} A) = (\operatorname{adj} A)A = |A|\,I$. The diagonal entries are $|A|$ (own cofactors); every other entry is 0 (another row's cofactors).
- Taking determinants of both sides and dividing by $|A|$ (when $|A| \ne 0$) gives $|\operatorname{adj} A| = |A|^{n-1}$. The result is also true when $|A| = 0$: then both sides are 0.

## 6. Singular matrices and the inverse

| $\lvert A \rvert$ | Name | Inverse |
|---|---|---|
| $= 0$ | singular | does not exist |
| $\ne 0$ | non-singular | exists, unique |

- $|AB| = |A|\,|B|$ (NCERT Theorem 3). So if $A$ and $B$ are non-singular, $AB$ and $BA$ are non-singular too.
- **$A$ is invertible if and only if $|A| \ne 0$**, and then $A^{-1} = \dfrac{1}{|A|}\operatorname{adj} A$.
- From $AA^{-1} = I$: $|A|\,|A^{-1}| = 1$, so $|A^{-1}| = \dfrac{1}{|A|}$.
- $(AB)^{-1} = B^{-1}A^{-1}$: the order reverses.

:::example{title="Inverse of a 2 × 2 matrix"}
$A = \begin{bmatrix} 2 & 5 \\ 3 & 2 \end{bmatrix}$: $|A| = 4 - 15 = -11$, so $A^{-1} = -\dfrac{1}{11}\begin{bmatrix} 2 & -5 \\ -3 & 2 \end{bmatrix}$.
:::

- **Inverse from a matrix equation.** If, say, $A^2 - 4A + I = O$ and $|A| \ne 0$, multiply by $A^{-1}$: $A - 4I + A^{-1} = O$, so $A^{-1} = 4I - A$. No cofactors needed.

## 7. Systems of linear equations

- **Consistent:** at least one solution exists. **Inconsistent:** no solution.
- Write the system as $AX = B$: $A$ = coefficients, $X$ = unknowns, $B$ = constants.
- **Matrix method:** if $|A| \ne 0$, then $X = A^{-1}B$, and this solution is unique.

| Condition | Result |
|---|---|
| $\lvert A\rvert \ne 0$ | unique solution |
| $\lvert A\rvert = 0$, $(\operatorname{adj} A)B \ne O$ | no solution |
| $\lvert A\rvert = 0$, $(\operatorname{adj} A)B = O$ | infinitely many or none |

- In the last case, check the equations themselves (for example by elimination).
- NCERT solves by the matrix method only systems with a unique solution.

:::example{title="Matrix method, 2 variables"}
$2x + 5y = 1$, $3x + 2y = 7$. Using $A^{-1}$ from the example above:
$X = -\dfrac{1}{11}\begin{bmatrix} 2 - 35 \\ -3 + 14 \end{bmatrix} = \begin{bmatrix} 3 \\ -1 \end{bmatrix}$, so $x = 3$, $y = -1$.
:::

## 8. Properties of determinants (exam extra)

The rationalised NCERT book dropped this section, and the JEE Main 2026 syllabus does not name it, but its "evaluation of determinants" questions often need it. Each rule for rows works for columns too, because $|A^T| = |A|$.

- Swapping two rows changes the sign.
- Two equal or proportional rows, or a row of zeros, give 0.
- A factor common to one row comes out as a factor of $\Delta$.
- $R_i \to R_i + kR_j$ ($i \ne j$) leaves $\Delta$ unchanged. Use it to create zeros before expanding.
- If every entry of a row is a sum of two terms, $\Delta$ splits into the sum of two determinants.
- For a triangular matrix, $\Delta$ = product of the diagonal entries.

:::example{title="Make a common factor appear"}
$\begin{vmatrix} 1 & a & b+c \\ 1 & b & c+a \\ 1 & c & a+b \end{vmatrix}$: $C_3 \to C_3 + C_2$ makes every entry of column 3 equal to $a + b + c$. Then columns 1 and 3 are proportional, so $\Delta = 0$.
:::

## 9. Cramer's rule and homogeneous systems (exam extra)

- For $\Delta = |A| \ne 0$: $x = \dfrac{\Delta_1}{\Delta}$, $y = \dfrac{\Delta_2}{\Delta}$, $z = \dfrac{\Delta_3}{\Delta}$, where $\Delta_k$ is $\Delta$ with column $k$ replaced by the constants. This is $X = A^{-1}B$ written entry by entry.
- $AX = O$ (all constants 0) always has the solution $x = y = z = 0$. It has other solutions as well exactly when $|A| = 0$.
