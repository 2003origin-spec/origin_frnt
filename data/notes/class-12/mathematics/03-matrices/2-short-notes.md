---
title: "Matrices: Short Notes"
type: short_notes
chapter: c12.mathematics.matrices
order: 2
---

## 1. What a matrix is

- A **matrix** is an ordered rectangular array of numbers or functions. Its numbers (or functions) are its **elements** or **entries**. NCERT uses only real numbers or real-valued functions.
- Horizontal lines of elements are **rows**; vertical lines are **columns**.
- A matrix with $m$ rows and $n$ columns has **order** $m \times n$ (read "$m$ by $n$") and $mn$ elements.
- $a_{ij}$ is the element in row $i$ and column $j$, the $(i, j)$th element. We write $A = [a_{ij}]_{m \times n}$.
- A point $(x, y)$ can be written as a column $\begin{bmatrix} x \\ y \end{bmatrix}$ or a row $[x \ \ y]$. The vertices of a figure can be stacked into one matrix.

:::example{title="Building a matrix from a rule"}
$2 \times 2$ matrix with $a_{ij} = i + 2j$:

$a_{11} = 3$, $a_{12} = 5$, $a_{21} = 4$, $a_{22} = 6$. So
$$A = \begin{bmatrix} 3 & 5 \\ 4 & 6 \end{bmatrix}$$
:::

## 2. Types of matrices

| Type | Order | Rule |
|---|---|---|
| Column | $m \times 1$ | one column |
| Row | $1 \times n$ | one row |
| Square | $n \times n$ | rows = columns |
| Diagonal | $n \times n$ | $a_{ij} = 0$ for $i \ne j$ |
| Scalar | $n \times n$ | diagonal, all $a_{ii}$ equal |
| Identity $I_n$ | $n \times n$ | scalar with $a_{ii} = 1$ |
| Zero $O$ | any | every element 0 |

- The **diagonal** of a square matrix of order $n$ is $a_{11}, a_{22}, \dots, a_{nn}$.
- Every identity matrix is scalar, every scalar matrix is diagonal, and every diagonal matrix is square. The reverse is not true.
- A zero matrix need not be square: $[0 \ \ 0]$ is a $1 \times 2$ zero matrix.

## 3. Equality of matrices

- $A = B$ only if (i) they have the **same order**, and (ii) $a_{ij} = b_{ij}$ for every $i$ and $j$.
- So an equation between two $2 \times 2$ matrices is really **four** equations, one per position. Solve them together.

## 4. Addition, scalar multiple, difference

- **Sum:** add elements in the same position. Defined only for the same order.
- **Scalar multiple:** $kA$ multiplies **every** element by $k$.
- **Negative and difference:** $-A = (-1)A$, and $A - B = A + (-1)B$.
- Addition is commutative and associative. $O$ (same order) is the additive identity and $-A$ is the additive inverse.
- $k(A + B) = kA + kB$ and $(k + l)A = kA + lA$.

:::example{title="Solving a matrix equation"}
If $2A + 3X = 5B$, treat it like ordinary algebra (addition is commutative, $O$ is the identity):
$$X = \tfrac13\,(5B - 2A)$$
For $X + Y = P$ and $X - Y = Q$: add to get $X = \tfrac12(P + Q)$, subtract to get $Y = \tfrac12(P - Q)$.
:::

## 5. Multiplication of matrices

- $AB$ is defined only when **columns of $A$ = rows of $B$**. Then $(m \times n)(n \times p)$ gives $m \times p$.
- The $(i, k)$th element of $AB$ = row $i$ of $A$ times column $k$ of $B$, element by element, added up.
- If $AB$ is defined, $BA$ need not be. When both are defined they may have different orders ($A$: $2 \times 3$, $B$: $3 \times 2$ gives $AB$: $2 \times 2$ and $BA$: $3 \times 3$).

:::example{title="Row times column"}
$$A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$$
$$B = \begin{bmatrix} 5 & 6 \\ 7 & 8 \end{bmatrix}$$
First element of $AB$: $1 \cdot 5 + 2 \cdot 7 = 19$. In full:
$$AB = \begin{bmatrix} 19 & 22 \\ 43 & 50 \end{bmatrix}$$
$$BA = \begin{bmatrix} 23 & 34 \\ 31 & 46 \end{bmatrix}$$
So $AB \ne BA$ here.
:::

- **Not commutative:** even for square matrices of the same order, $AB$ and $BA$ are usually different. Some pairs do commute, for example two diagonal matrices of the same order.
- **Zero product:** $AB = O$ can happen with $A \ne O$ and $B \ne O$.

:::example{title="Two non-zero matrices with product O"}
$$A = \begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix}$$
$$B = \begin{bmatrix} 2 & -4 \\ -1 & 2 \end{bmatrix}$$
Then $AB = O$, the $2 \times 2$ zero matrix. (But $BA \ne O$.)
:::

- **Laws that do hold:** associative $(AB)C = A(BC)$; distributive $A(B + C) = AB + AC$ and $(A + B)C = AC + BC$; identity $IA = AI = A$ for a square $A$.
- Powers: $A^2 = AA$, $A^3 = A^2A$, and so on (square $A$ only). A polynomial in $A$ uses $I$ for the constant: $A^2 - 5A + 7I$, never $A^2 - 5A + 7$.

## 6. Transpose

- $A'$ (or $A^T$): rows become columns. If $A$ is $m \times n$, then $A'$ is $n \times m$ and the $(i, j)$th element of $A'$ is $a_{ji}$.
- Properties: $(A')' = A$, $(kA)' = kA'$, $(A + B)' = A' + B'$, $(AB)' = B'A'$ (order reversed).

:::example{title="Transpose of a 2 × 3 matrix"}
$$A = \begin{bmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{bmatrix}$$
$$A' = \begin{bmatrix} 1 & 4 \\ 2 & 5 \\ 3 & 6 \end{bmatrix}$$
:::

## 7. Symmetric and skew symmetric matrices

| | Symmetric | Skew symmetric |
|---|---|---|
| Condition | $A' = A$ | $A' = -A$ |
| Elements | $a_{ji} = a_{ij}$ | $a_{ji} = -a_{ij}$ |
| Diagonal | anything | all zero |

- Both are defined only for square matrices.
- Skew symmetric diagonal: putting $i = j$ gives $a_{ii} = -a_{ii}$, so $a_{ii} = 0$.
- **Theorem 1:** for a square $A$, $A + A'$ is symmetric and $A - A'$ is skew symmetric.
- **Theorem 2:** every square matrix is a symmetric matrix plus a skew symmetric matrix:
$$A = \tfrac12(A + A') + \tfrac12(A - A')$$
- (NCERT Example 24) If $A$ and $B$ are symmetric of the same order, then $AB$ is symmetric **if and only if** $AB = BA$.

:::example{title="Splitting a matrix"}
$$A = \begin{bmatrix} 1 & 5 \\ 3 & 2 \end{bmatrix}$$
$$\tfrac12(A + A') = \begin{bmatrix} 1 & 4 \\ 4 & 2 \end{bmatrix}$$
$$\tfrac12(A - A') = \begin{bmatrix} 0 & 1 \\ -1 & 0 \end{bmatrix}$$
The first is symmetric, the second skew symmetric, and they add up to $A$.
:::

## 8. Invertible matrices

- A square matrix $A$ of order $m$ is **invertible** if there is a square matrix $B$ of the same order with $AB = BA = I$. Then $B = A^{-1}$, and $A$ is also the inverse of $B$.
- A rectangular (non-square) matrix has **no** inverse: $AB$ and $BA$ could not both be defined and equal.
- **Theorem 3:** the inverse, if it exists, is unique. ($B = BI = B(AC) = (BA)C = IC = C$.)
- **Theorem 4:** $(AB)^{-1} = B^{-1}A^{-1}$ for invertible $A$, $B$ of the same order.
- Not every square matrix has an inverse. The test ($|A| \ne 0$) and the method ($A^{-1} = \frac{1}{|A|}\operatorname{adj} A$) come in **Chapter 4, Determinants**. The older "elementary row operations" method is not in the current (rationalised) NCERT book.

:::tip
To show that $B$ is the inverse of $A$, just multiply: check that $AB = I$ (and $BA = I$).
:::

## 9. Exam extras (in the JEE Main syllabus, not in NCERT Chapter 3)

- **Trace** $\operatorname{tr} A$ = sum of the diagonal elements of a square matrix. For square $A$, $B$ of the same order, $\operatorname{tr}(AB) = \operatorname{tr}(BA)$ even when $AB \ne BA$.
- **Orthogonal:** $AA' = I$. NCERT Exercise 3.3 asks you to verify $A'A = I$ for the rotation-type matrix $\begin{bmatrix} \cos\alpha & \sin\alpha \\ -\sin\alpha & \cos\alpha \end{bmatrix}$.
- **Idempotent** ($A^2 = A$) and **involutory** ($A^2 = I$) matrices appear in NCERT's miscellaneous exercise as conditions, without these names. **Nilpotent** means $A^k = O$ for some natural number $k$.
- For a $2 \times 2$ matrix $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$, $A^2 - (\operatorname{tr} A)A + (ad - bc)I = O$. It turns $A^2$, $A^3$ and (when $ad - bc \ne 0$) $A^{-1}$ into quick algebra.
