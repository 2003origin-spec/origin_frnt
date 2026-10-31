---
title: "Vector Algebra: Quick Practice"
type: practice
chapter: c12.mathematics.vector-algebra
order: 4
---

Try each question first, then tap **Show answer**.

## Components and direction

:::question{title="1. Given length" exam="JEE Main level"}
Find the vector of magnitude 9 in the direction of $2\hat i - \hat j + 2\hat k$.

---

$|2\hat i - \hat j + 2\hat k| = \sqrt{4 + 1 + 4} = 3$, so the unit vector is $\tfrac13(2\hat i - \hat j + 2\hat k)$.

Times 9: **$6\hat i - 3\hat j + 6\hat k$**.
:::

:::question{title="2. Direction cosines" exam="JEE Main level"}
Find the direction cosines of $\overrightarrow{AB}$, where $A(1, 2, -3)$ and $B(3, -1, 3)$.

---

$\overrightarrow{AB} = 2\hat i - 3\hat j + 6\hat k$ and $|\overrightarrow{AB}| = \sqrt{4 + 9 + 36} = 7$.

Direction cosines: **$\dfrac27, -\dfrac37, \dfrac67$**.
:::

:::question{title="3. External division" exam="JEE Main level"}
$P$ and $Q$ have position vectors $2\hat i + \hat j - \hat k$ and $5\hat i - 2\hat j + 8\hat k$. Find the position vector of the point $R$ that divides $PQ$ externally in the ratio $2 : 1$.

---

$\vec r = \dfrac{2\vec b - 1\,\vec a}{2 - 1} = 2(5\hat i - 2\hat j + 8\hat k) - (2\hat i + \hat j - \hat k)$

$\vec r =$ **$8\hat i - 5\hat j + 17\hat k$**.
:::

## Scalar product

:::question{title="4. Perpendicular" exam="JEE Main level"}
$\vec a = \hat i + 2\hat j - \hat k$, $\vec b = 2\hat i - \hat j + \hat k$ and $\vec c = \hat i + \hat j + \hat k$. Find $\lambda$ so that $\vec a + \lambda\vec b$ is perpendicular to $\vec c$.

---

$\vec a + \lambda\vec b = (1 + 2\lambda)\hat i + (2 - \lambda)\hat j + (-1 + \lambda)\hat k$.

Dot with $\vec c$: $(1 + 2\lambda) + (2 - \lambda) + (-1 + \lambda) = 2 + 2\lambda = 0$, so $\lambda =$ **$-1$**.
:::

:::question{title="5. Length of a difference" exam="JEE Main level"}
$|\vec a| = 3$, $|\vec b| = 5$ and $|\vec a + \vec b| = 7$. Find $|\vec a - \vec b|$.

---

$|\vec a + \vec b|^2 = 9 + 25 + 2\,\vec a \cdot \vec b = 49$, so $\vec a \cdot \vec b = \dfrac{15}{2}$.

$|\vec a - \vec b|^2 = 9 + 25 - 15 = 19$, so $|\vec a - \vec b| =$ **$\sqrt{19}$**. (The angle between them is $60^\circ$.)
:::

:::question{title="6. Projection" exam="JEE Main level"}
Find the projection of $\vec a = 2\hat i + 3\hat j + 6\hat k$ on $\vec b = \hat i - 2\hat j + 2\hat k$.

---

$\vec a \cdot \vec b = 2 - 6 + 12 = 8$ and $|\vec b| = \sqrt{1 + 4 + 4} = 3$.

Projection $= \dfrac{\vec a \cdot \vec b}{|\vec b|} =$ **$\dfrac83$**.
:::

:::question{title="7. Three vectors adding to zero" exam="JEE Main level"}
$\vec a + \vec b + \vec c = \vec 0$, with $|\vec a| = 3$, $|\vec b| = 4$ and $|\vec c| = 5$. Find $\vec a \cdot \vec b + \vec b \cdot \vec c + \vec c \cdot \vec a$.

---

Square $\vec a + \vec b + \vec c = \vec 0$:

$9 + 16 + 25 + 2(\vec a \cdot \vec b + \vec b \cdot \vec c + \vec c \cdot \vec a) = 0$.

So the sum is $-\dfrac{50}{2} =$ **$-25$**.
:::

## Vector product

:::question{title="8. Perpendicular unit vectors" exam="JEE Main level"}
Find the unit vectors perpendicular to both $\vec a = \hat i + 2\hat j + 3\hat k$ and $\vec b = 3\hat i + 2\hat j + \hat k$.

---

$\hat i$: $(2)(1) - (3)(2) = -4$. $\hat j$: $-\left[(1)(1) - (3)(3)\right] = 8$. $\hat k$: $(1)(2) - (2)(3) = -4$.

$\vec a \times \vec b = -4\hat i + 8\hat j - 4\hat k$, with length $\sqrt{96} = 4\sqrt6$.

Unit vectors: **$\pm\dfrac{1}{\sqrt6}\left(-\hat i + 2\hat j - \hat k\right)$**.
:::

:::question{title="9. Area of a triangle" exam="JEE Main level"}
Find the area of the triangle with vertices $A(1, 0, 2)$, $B(2, 2, 1)$ and $C(0, 1, 3)$.

---

$\overrightarrow{AB} = \hat i + 2\hat j - \hat k$ and $\overrightarrow{AC} = -\hat i + \hat j + \hat k$.

$\overrightarrow{AB} \times \overrightarrow{AC} = 3\hat i + 0\hat j + 3\hat k$, with length $\sqrt{18} = 3\sqrt2$.

Area $= \tfrac12 \times 3\sqrt2 =$ **$\dfrac{3\sqrt2}{2}$** square units.
:::

:::question{title="10. Dot from cross" exam="JEE Main level"}
$|\vec a| = 2$, $|\vec b| = 5$ and $|\vec a \times \vec b| = 8$. Find $|\vec a \cdot \vec b|$.

---

$|\vec a \times \vec b|^2 + (\vec a \cdot \vec b)^2 = |\vec a|^2\,|\vec b|^2$ gives $64 + (\vec a \cdot \vec b)^2 = 100$.

So $(\vec a \cdot \vec b)^2 = 36$ and $|\vec a \cdot \vec b| =$ **6**. ($\vec a \cdot \vec b$ itself can be $6$ or $-6$.)
:::
