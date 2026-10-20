---
title: "Matrices: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.matrices
order: 1
---

Notation as in NCERT: $A = [a_{ij}]_{m \times n}$, where $a_{ij}$ is the element in row $i$ and column $j$. The transpose is written $A'$ (or $A^T$), the identity matrix $I$ (or $I_n$), the zero matrix $O$.

## Order and elements

:::formula{title="Number of elements"}
$$\text{elements in an } m \times n \text{ matrix} = mn$$
$m$ = number of rows, $n$ = number of columns. A matrix with $N$ elements can have order $m \times n$ for every pair of natural numbers with $mn = N$. So the number of possible orders = the number of divisors of $N$.
:::

:::formula{title="Equality"}
$$A = B \iff a_{ij} = b_{ij} \text{ for all } i, j$$
Only for matrices of the **same order**. Equal matrices give one equation per position.
:::

## Types (square matrix of order n unless stated)

:::formula{title="Diagonal, scalar, identity"}
Diagonal: $a_{ij} = 0$ when $i \ne j$.

Scalar: diagonal, and every $a_{ii} = k$ (one constant $k$).

Identity:
$$a_{ij} = \begin{cases} 1, & i = j \\ 0, & i \ne j \end{cases}$$
The diagonal of a square matrix is $a_{11}, a_{22}, \dots, a_{nn}$.
:::

:::formula{title="Row, column, zero"}
Row matrix: order $1 \times n$. Column matrix: order $m \times 1$. Zero matrix $O$: every element is 0 (any order, not only square).
:::

## Addition and scalar multiplication

:::formula{title="Sum and difference"}
$$A + B = [a_{ij} + b_{ij}]$$
$$A - B = A + (-1)B$$
Only when $A$ and $B$ have the **same order**. The answer has that order too.
:::

:::formula{title="Scalar multiple and negative"}
$$kA = [k\,a_{ij}]$$
$$-A = (-1)A$$
$k$ = any number (scalar). Every element is multiplied by $k$.
:::

:::formula{title="Laws of addition"}
$$A + B = B + A$$
$$(A + B) + C = A + (B + C)$$
$$A + O = A$$
$$A + (-A) = O$$
All matrices of the same order $m \times n$; $O$ is $m \times n$.
:::

:::formula{title="Laws of scalar multiplication"}
$$k(A + B) = kA + kB$$
$$(k + l)A = kA + lA$$
$k, l$ = scalars, $A$ and $B$ of the same order.
:::

## Multiplication

:::formula{title="Product of two matrices"}
$A = [a_{ij}]_{m \times n}$ and $B = [b_{jk}]_{n \times p}$. Then $AB = C = [c_{ik}]_{m \times p}$ with
$$c_{ik} = \sum_{j=1}^{n} a_{ij}\, b_{jk}$$
Row $i$ of $A$ times column $k$ of $B$, element by element, then add. Defined only when (columns of $A$) = (rows of $B$).
:::

:::formula{title="Orders in a product"}
$$(m \times n)(n \times p) \to m \times p$$
Both $AB$ and $BA$ are defined only when $A$ is $m \times n$ and $B$ is $n \times m$. Then $AB$ is $m \times m$ and $BA$ is $n \times n$.
:::

:::formula{title="Laws of multiplication"}
$$(AB)C = A(BC)$$
$$A(B + C) = AB + AC$$
$$(A + B)C = AC + BC$$
$$IA = AI = A$$
Whenever both sides are defined. In $IA = AI = A$, $A$ is square and $I$ has the same order.
:::

:::formula{title="Square of a sum"}
$$(A + B)^2 = A^2 + AB + BA + B^2$$
This equals $A^2 + 2AB + B^2$ **only if** $AB = BA$. In general $AB \ne BA$.
:::

:::formula{title="Powers of the rotation matrix (NCERT Example 23)"}
$$A = \begin{bmatrix} \cos\theta & \sin\theta \\ -\sin\theta & \cos\theta \end{bmatrix}$$
$$A^n = \begin{bmatrix} \cos n\theta & \sin n\theta \\ -\sin n\theta & \cos n\theta \end{bmatrix}$$
For every natural number $n$ (proved by induction in NCERT).
:::

## Transpose

:::formula{title="Transpose"}
$$A = [a_{ij}]_{m \times n} \Rightarrow A' = [a_{ji}]_{n \times m}$$
Rows of $A$ become the columns of $A'$.
:::

:::formula{title="Properties of transpose"}
$$(A')' = A$$
$$(kA)' = kA'$$
$$(A + B)' = A' + B'$$
$$(AB)' = B'A'$$
For matrices of suitable orders. Note the **reversed order** in the last one.
:::

## Symmetric and skew symmetric

:::formula{title="Definitions"}
Symmetric: $A' = A$, that is $a_{ji} = a_{ij}$.

Skew symmetric: $A' = -A$, that is $a_{ji} = -a_{ij}$. Then every diagonal element $a_{ii} = 0$.

Both are square matrices.
:::

:::formula{title="Symmetric + skew symmetric parts"}
For any square matrix $A$:
$$P = \tfrac12\,(A + A') \text{ is symmetric}$$
$$Q = \tfrac12\,(A - A') \text{ is skew symmetric}$$
$$A = P + Q$$
NCERT Theorems 1 and 2. $A + A'$ and $A - A'$ themselves are symmetric and skew symmetric.
:::

## Inverse

:::formula{title="Inverse"}
$$AB = BA = I \Rightarrow B = A^{-1}$$
$A$ and $B$ = square matrices of the same order. Then $A$ is **invertible**, and $A$ is also the inverse of $B$: $(A^{-1})^{-1} = A$. A rectangular matrix has no inverse. The inverse, if it exists, is unique.
:::

:::formula{title="Inverse of a product"}
$$(AB)^{-1} = B^{-1}A^{-1}$$
$A$, $B$ = invertible matrices of the same order (NCERT Theorem 4).
:::

:::formula{title="Inverse of a 2 × 2 matrix (from Chapter 4, Determinants)"}
$$A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$$
$$A^{-1} = \frac{1}{ad - bc}\begin{bmatrix} d & -b \\ -c & a \end{bmatrix}$$
Only when $ad - bc \ne 0$. Swap the diagonal, change the sign of the other two, divide by $ad - bc$.
:::

## Exam extras (in the JEE Main syllabus, not in NCERT Chapter 3)

:::formula{title="Trace"}
$\operatorname{tr} A$ = sum of the diagonal elements of a square matrix. Below, $A$ and $B$ are square matrices of the same order.
$$\operatorname{tr}(A + B) = \operatorname{tr} A + \operatorname{tr} B$$
$$\operatorname{tr}(kA) = k \operatorname{tr} A$$
$$\operatorname{tr}(AB) = \operatorname{tr}(BA)$$
$$\operatorname{tr} A' = \operatorname{tr} A$$
:::

:::formula{title="2 × 2 identity (check by multiplying out)"}
For any $2 \times 2$ matrix $A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}$:
$$A^2 - (a + d)\,A + (ad - bc)\,I = O$$
Useful for $A^2$, $A^3$ and, when $ad - bc \ne 0$, $A^{-1}$ without long multiplication. (This is the $2 \times 2$ case of the Cayley–Hamilton theorem. The general theorem is beyond the syllabus; the $2 \times 2$ identity is plain matrix algebra.)
:::

:::formula{title="More transpose rules"}
$$(ABC)' = C'B'A'$$
$$(A^n)' = (A')^n$$
$$(A^{-1})' = (A')^{-1}$$
The last one for invertible $A$.
:::

:::formula{title="Special square matrices"}
Orthogonal: $AA' = A'A = I$, so $A^{-1} = A'$.

Idempotent: $A^2 = A$. Involutory: $A^2 = I$. Nilpotent: $A^k = O$ for some natural number $k$.

NCERT uses $A'A = I$, $A^2 = A$ and $A^2 = I$ in exercises without naming them.
:::

:::formula{title="Counting matrices"}
Each element chosen from $k$ given numbers:
$$m \times n \text{ matrices}: k^{mn}$$
$$\text{symmetric } n \times n: k^{n(n+1)/2}$$
For symmetric matrices only the diagonal and the part above it are free.

The first count is in NCERT (Exercise 3.1 asks for $3 \times 3$ matrices with entries 0 or 1: $2^9 = 512$). The symmetric count is the exam extra.
:::
