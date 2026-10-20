---
title: "3D Geometry (Class 12): Quick Practice"
type: practice
chapter: c12.mathematics.three-dimensional-geometry
order: 4
---

Try each question first, then tap **Show answer**.

## Direction cosines

:::question{title="1. Third angle" exam="JEE Main level"}
A line makes $60^\circ$ with the $x$-axis and $45^\circ$ with the $y$-axis. It makes an acute angle with the $z$-axis. Find that angle.

---

$\cos^2\gamma = 1 - \cos^2 60^\circ - \cos^2 45^\circ = 1 - \dfrac14 - \dfrac12 = \dfrac14$.

So $\cos\gamma = \dfrac12$ (acute), and $\gamma =$ **$60^\circ$**.
:::

:::question{title="2. Two points" exam="JEE Main level"}
Find the direction cosines of the line directed from $A(1, -2, 3)$ to $B(3, 4, 0)$.

---

D.r.'s: $3 - 1,\ 4 + 2,\ 0 - 3 = 2, 6, -3$. Length $AB = \sqrt{4 + 36 + 9} = 7$.

Direction cosines: **$\dfrac27, \dfrac67, -\dfrac37$**.
:::

## Equation of a line

:::question{title="3. Standard form" exam="JEE Main level"}
Write the vector equation of the line
$$\frac{1 - x}{2} = \frac{y + 3}{-1} = \frac{2z - 4}{6}$$

---

Make each coefficient $+1$: $\dfrac{x - 1}{-2} = \dfrac{y + 3}{-1} = \dfrac{z - 2}{3}$.

Point $(1, -3, 2)$, d.r.'s $-2, -1, 3$:
**$\vec r = \hat i - 3\hat j + 2\hat k + \lambda(-2\hat i - \hat j + 3\hat k)$**.

(Any non-zero multiple of the direction, such as $2\hat i + \hat j - 3\hat k$, gives the same line.)
:::

:::question{title="4. Point on a line" exam="JEE Main level"}
The point $(k, 5, m)$ lies on the line through $A(1, 2, 3)$ and $B(3, 3, 1)$. Find $k$ and $m$.

---

$\overrightarrow{AB} = (2, 1, -2)$, so a general point is $(1 + 2\lambda,\ 2 + \lambda,\ 3 - 2\lambda)$.

$y = 5$ gives $\lambda = 3$. Then $x = 7$ and $z = 3 - 6 = -3$.

**$k = 7$, $m = -3$**.
:::

## Angle between lines

:::question{title="5. Perpendicular lines" exam="JEE Main level"}
Find $k$ if these lines are perpendicular:
$$\frac{x - 1}{2} = \frac{y}{1} = \frac{z - 4}{k}$$
$$\frac{1 - x}{3} = \frac{y - 2}{k} = \frac{z + 1}{2}$$

---

The second line is $\dfrac{x - 1}{-3} = \dfrac{y - 2}{k} = \dfrac{z + 1}{2}$, so its d.r.'s are $-3, k, 2$.

$2(-3) + 1(k) + k(2) = 0$ gives $3k = 6$, so **$k = 2$**.

(Reading the d.r.'s as $3, k, 2$ gives the wrong answer $k = -2$.)
:::

:::question{title="6. Acute angle" exam="JEE Main level"}
Find the acute angle between the lines
$$\vec r = \hat i + \hat k + \lambda(2\hat i - \hat j + 2\hat k)$$
$$\frac{x - 3}{1} = \frac{y + 1}{2} = \frac{z}{-2}$$

---

$\vec b_1 = (2, -1, 2)$, $\vec b_2 = (1, 2, -2)$. $\vec b_1 \cdot \vec b_2 = 2 - 2 - 4 = -4$, and $|\vec b_1| = |\vec b_2| = 3$.

$\cos\theta = \dfrac{|-4|}{3 \times 3} = \dfrac49$, so $\theta =$ **$\cos^{-1}\dfrac49$**.
:::

## Distances

:::question{title="7. Skew lines" exam="JEE Main level"}
Find the shortest distance between
$$\vec r = \hat i - \hat k + \lambda(\hat i + 2\hat j + 2\hat k)$$
$$\vec r = 3\hat i - 2\hat k + \mu(2\hat i + 2\hat j + 3\hat k)$$

---

$\vec a_2 - \vec a_1 = 2\hat i - \hat k$.

$\vec b_1 \times \vec b_2 = (6 - 4)\hat i - (3 - 4)\hat j + (2 - 4)\hat k = 2\hat i + \hat j - 2\hat k$, of length 3.

$d = \dfrac{|2(2) + 1(0) + (-2)(-1)|}{3} = \dfrac63 =$ **2**.
:::

:::question{title="8. Lines that meet" exam="JEE Main level"}
Find $k$ so that these lines intersect, and find the point where they meet:
$$\frac{x - 1}{2} = \frac{y - 1}{1} = \frac{z + 1}{2}$$
$$\frac{x - 2}{1} = \frac{y - k}{-1} = \frac{z + 2}{3}$$

---

The d.r.'s $2, 1, 2$ and $1, -1, 3$ are not proportional, so the lines meet exactly when the determinant is 0. With $\vec a_2 - \vec a_1 = (1,\ k - 1,\ -1)$:
$$D = \begin{vmatrix} 1 & k - 1 & -1 \\ 2 & 1 & 2 \\ 1 & -1 & 3 \end{vmatrix}$$
Expanding along the first row: $D = 5 - 4(k - 1) + 3 = 12 - 4k$. So **$k = 3$**. The first line at $\lambda = 1$ and the second at $\mu = 1$ both give the point **$(3, 2, 1)$**.
:::

:::question{title="9. Parallel lines" exam="JEE Main level"}
Find the distance between
$$\vec r = \hat i + \hat j + \lambda(\hat i + 2\hat j + 2\hat k)$$
$$\begin{aligned} \vec r = {} & 3\hat i + 2\hat j - 2\hat k \\ & + \mu(2\hat i + 4\hat j + 4\hat k) \end{aligned}$$

---

$2\hat i + 4\hat j + 4\hat k = 2\vec b$ with $\vec b = \hat i + 2\hat j + 2\hat k$, so the lines are parallel. $|\vec b| = 3$.

$\vec a_2 - \vec a_1 = 2\hat i + \hat j - 2\hat k$, and $\vec b \times (\vec a_2 - \vec a_1) = -6\hat i + 6\hat j - 3\hat k$, of length 9.

$d = \dfrac93 =$ **3**.
:::

:::question{title="10. Foot of the perpendicular (exam extra)" exam="JEE Main level"}
Find the foot of the perpendicular from $P(0, 6, 4)$ to the line $\dfrac{x - 1}{1} = \dfrac{y - 2}{2} = \dfrac{z - 3}{2}$, and the distance of $P$ from the line.

---

General point $F(1 + \lambda,\ 2 + 2\lambda,\ 3 + 2\lambda)$, so $\overrightarrow{PF} = (1 + \lambda,\ 2\lambda - 4,\ 2\lambda - 1)$.

$\overrightarrow{PF} \cdot (1, 2, 2) = 9\lambda - 9 = 0$, so $\lambda = 1$.

Foot **$(2, 4, 5)$**. $\overrightarrow{PF} = (2, -2, 1)$, so the distance is **3**.
:::
