---
title: "Vector Algebra: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.vector-algebra
order: 1
---

Notation as in NCERT: a vector is $\vec a$, its length $|\vec a|$ (or $a$), the unit vector along it $\hat a$. The unit vectors along the $x$, $y$ and $z$-axes are $\hat i$, $\hat j$, $\hat k$. In component form:
$$\vec a = a_1\hat i + a_2\hat j + a_3\hat k$$
$$\vec b = b_1\hat i + b_2\hat j + b_3\hat k$$

## Magnitude and direction

:::formula{title="Position vector and its length"}
For the point $P(x, y, z)$:
$$\overrightarrow{OP} = \vec r = x\hat i + y\hat j + z\hat k$$
$$|\vec r| = \sqrt{x^2 + y^2 + z^2}$$
$O$ = origin. $x, y, z$ are the scalar components; $x\hat i$, $y\hat j$, $z\hat k$ are the vector components.
:::

:::formula{title="Unit vector"}
$$\hat a = \frac{\vec a}{|\vec a|}$$
Only for $\vec a \ne \vec 0$. A vector of length $k$ along $\vec a$ is $k\,\hat a$.
:::

:::formula{title="Direction cosines"}
$$l = \cos\alpha = \frac{x}{r}$$
$$m = \cos\beta = \frac{y}{r}$$
$$n = \cos\gamma = \frac{z}{r}$$
$\alpha, \beta, \gamma$ = angles with the positive $x$, $y$, $z$-axes; $r = |\vec r| \ne 0$.
:::

:::formula{title="Sum of squares of direction cosines"}
$$l^2 + m^2 + n^2 = 1$$
The unit vector along the vector is $l\hat i + m\hat j + n\hat k$. Direction ratios $a, b, c$ (the components, or any non-zero multiple of them) need **not** have $a^2 + b^2 + c^2 = 1$.
:::

:::formula{title="Vector joining two points"}
From $P_1(x_1, y_1, z_1)$ to $P_2(x_2, y_2, z_2)$:
$$\begin{aligned} \overrightarrow{P_1P_2} = {} & (x_2 - x_1)\,\hat i \\ & + (y_2 - y_1)\,\hat j \\ & + (z_2 - z_1)\,\hat k \end{aligned}$$
In words: position vector of the end **minus** position vector of the start.
:::

## Addition and scalar multiples

:::formula{title="Triangle law"}
$$\overrightarrow{AB} + \overrightarrow{BC} = \overrightarrow{AC}$$
Sides of a triangle taken in order add to zero:
$$\begin{aligned} & \overrightarrow{AB} + \overrightarrow{BC} \\ & + \overrightarrow{CA} = \vec 0 \end{aligned}$$
:::

:::formula{title="In components"}
$$\begin{aligned} \vec a \pm \vec b = {} & (a_1 \pm b_1)\,\hat i \\ & + (a_2 \pm b_2)\,\hat j \\ & + (a_3 \pm b_3)\,\hat k \end{aligned}$$
$$\begin{aligned} \lambda\vec a = {} & \lambda a_1\,\hat i + \lambda a_2\,\hat j \\ & + \lambda a_3\,\hat k \end{aligned}$$
$$|\lambda\vec a| = |\lambda|\,|\vec a|$$
$\vec a = \vec b$ only when $a_1 = b_1$, $a_2 = b_2$ and $a_3 = b_3$.
:::

:::formula{title="Collinear vectors"}
$$\vec b = \lambda\vec a$$
$$\frac{b_1}{a_1} = \frac{b_2}{a_2} = \frac{b_3}{a_3} = \lambda$$
For non-zero $\vec a$. Same direction if $\lambda > 0$, opposite if $\lambda < 0$. If some $a_i = 0$, the matching $b_i$ must be 0 too.
:::

## Section formula

$P$ and $Q$ have position vectors $\vec a$ and $\vec b$. $R$ divides $PQ$ in the ratio $m : n$ (so $PR : RQ = m : n$).

:::formula{title="Internal division"}
$$\vec r = \frac{m\vec b + n\vec a}{m + n}$$
$m, n > 0$. The number $m$ goes with the **far** end $\vec b$.
:::

:::formula{title="External division"}
$$\vec r = \frac{m\vec b - n\vec a}{m - n}$$
For $m \ne n$. Here $PR : QR = m : n$ with $R$ outside $PQ$.
:::

:::formula{title="Midpoint"}
$$\vec r = \frac{\vec a + \vec b}{2}$$
:::

## Scalar (dot) product

:::formula{title="Definition"}
$$\vec a \cdot \vec b = |\vec a|\,|\vec b|\cos\theta$$
$\theta$ = angle between the vectors, $0 \le \theta \le \pi$. The answer is a **number**. If $\vec a = \vec 0$ or $\vec b = \vec 0$, then $\vec a \cdot \vec b = 0$.
:::

:::formula{title="In components"}
$$\vec a \cdot \vec b = a_1b_1 + a_2b_2 + a_3b_3$$
$$\hat i \cdot \hat i = \hat j \cdot \hat j = \hat k \cdot \hat k = 1$$
$$\hat i \cdot \hat j = \hat j \cdot \hat k = \hat k \cdot \hat i = 0$$
:::

:::formula{title="Angle between two vectors"}
$$\cos\theta = \frac{\vec a \cdot \vec b}{|\vec a|\,|\vec b|}$$
For non-zero vectors. $\vec a \perp \vec b \iff \vec a \cdot \vec b = 0$.
:::

:::formula{title="Square of a length"}
$$\vec a \cdot \vec a = |\vec a|^2$$
$$\begin{aligned} & |\vec a \pm \vec b|^2 \\ & = |\vec a|^2 + |\vec b|^2 \pm 2\,\vec a \cdot \vec b \end{aligned}$$
$$(\vec a + \vec b) \cdot (\vec a - \vec b) = |\vec a|^2 - |\vec b|^2$$
:::

:::formula{title="Projection of a on b"}
$$\vec a \cdot \hat b = \frac{\vec a \cdot \vec b}{|\vec b|}$$
This is the projection of $\vec a$ on $\vec b$: a number, negative when $\theta > 90^\circ$ ($\vec b \ne \vec 0$). The projection **vector** (its formula is not printed in NCERT) is
$$\left(\frac{\vec a \cdot \vec b}{|\vec b|^2}\right)\vec b$$
:::

:::formula{title="Two inequalities"}
$$|\vec a \cdot \vec b| \le |\vec a|\,|\vec b|$$
$$|\vec a + \vec b| \le |\vec a| + |\vec b|$$
Cauchy–Schwarz and triangle inequality. Equality in the second when $\vec a$, $\vec b$ point the same way (or one of them is $\vec 0$).
:::

## Vector (cross) product

:::formula{title="Definition"}
$$\vec a \times \vec b = |\vec a|\,|\vec b|\sin\theta\;\hat n$$
$0 \le \theta \le \pi$. $\hat n$ = unit vector perpendicular to both, such that $\vec a, \vec b, \hat n$ form a right-handed system. The answer is a **vector**. If $\vec a = \vec 0$ or $\vec b = \vec 0$, then $\vec a \times \vec b = \vec 0$.
:::

:::formula{title="In components"}
$$\vec a \times \vec b = \begin{vmatrix} \hat i & \hat j & \hat k \\ a_1 & a_2 & a_3 \\ b_1 & b_2 & b_3 \end{vmatrix}$$
Expanded:
$$\begin{aligned} \vec a \times \vec b = {} & (a_2b_3 - a_3b_2)\,\hat i \\ & - (a_1b_3 - a_3b_1)\,\hat j \\ & + (a_1b_2 - a_2b_1)\,\hat k \end{aligned}$$
:::

:::formula{title="Unit vectors"}
$$\hat i \times \hat i = \hat j \times \hat j = \vec 0$$
$$\hat k \times \hat k = \vec 0$$
$$\hat i \times \hat j = \hat k$$
$$\hat j \times \hat k = \hat i$$
$$\hat k \times \hat i = \hat j$$
Reverse the order and the sign changes: $\hat j \times \hat i = -\hat k$, $\hat k \times \hat j = -\hat i$, $\hat i \times \hat k = -\hat j$.
:::

:::formula{title="Order matters"}
$$\vec b \times \vec a = -\,\vec a \times \vec b$$
$$\begin{aligned} & \vec a \times (\vec b + \vec c) \\ & = \vec a \times \vec b + \vec a \times \vec c \end{aligned}$$
:::

:::formula{title="Parallel test and angle"}
$$\vec a \parallel \vec b \iff \vec a \times \vec b = \vec 0$$
$$\sin\theta = \frac{|\vec a \times \vec b|}{|\vec a|\,|\vec b|}$$
For non-zero vectors. $\sin\theta$ alone cannot tell $\theta$ from $\pi - \theta$; use the dot product for that.
:::

:::formula{title="Unit vector perpendicular to both"}
$$\hat n = \pm\,\frac{\vec a \times \vec b}{|\vec a \times \vec b|}$$
For non-parallel $\vec a$, $\vec b$. Both signs are answers.
:::

:::formula{title="Areas"}
Parallelogram with adjacent sides $\vec a$, $\vec b$:
$$\text{Area} = |\vec a \times \vec b|$$
Triangle with adjacent sides $\vec a$, $\vec b$ (for triangle $ABC$, take $\overrightarrow{AB}$ and $\overrightarrow{AC}$):
$$\text{Area} = \tfrac12\,|\vec a \times \vec b|$$
:::

:::formula{title="Dot and cross together"}
$$\begin{aligned} & |\vec a \times \vec b|^2 + (\vec a \cdot \vec b)^2 \\ & = |\vec a|^2\,|\vec b|^2 \end{aligned}$$
Follows from $\sin^2\theta + \cos^2\theta = 1$ (exam extra: not printed in NCERT).
:::

## Exam extras

:::formula{title="Parallelogram from its diagonals"}
$$\text{Area} = \tfrac12\,|\vec d_1 \times \vec d_2|$$
$\vec d_1$, $\vec d_2$ = the two diagonal vectors. Exam extra, not in NCERT.
:::

:::formula{title="Scalar triple product (beyond the syllabus)"}
$$[\vec a\ \vec b\ \vec c] = \vec a \cdot (\vec b \times \vec c)$$
$$[\vec a\ \vec b\ \vec c] = \begin{vmatrix} a_1 & a_2 & a_3 \\ b_1 & b_2 & b_3 \\ c_1 & c_2 & c_3 \end{vmatrix}$$
Not in the current NCERT book and not named in the JEE Main 2026 syllabus. It gives the volume of the box on $\vec a, \vec b, \vec c$ (take $|\ |$), and it is 0 exactly when the three vectors are coplanar.
:::
