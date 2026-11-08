---
title: "Vector Algebra: Short Notes"
type: short_notes
chapter: c12.mathematics.vector-algebra
order: 2
---

## 1. Scalars and vectors

- A **scalar** has only a size (magnitude): length, mass, time, speed, work, temperature.
- A **vector** has a magnitude **and** a direction: displacement, velocity, force, weight, momentum.
- A vector is drawn as a directed line segment $\overrightarrow{AB}$. $A$ is the **initial point**, $B$ the **terminal point**, and the length $|\overrightarrow{AB}|$ is its magnitude. A length is never negative.

## 2. Position vector and direction

- The **position vector** of $P(x, y, z)$ is $\overrightarrow{OP} = x\hat i + y\hat j + z\hat k$, with length $\sqrt{x^2 + y^2 + z^2}$.
- The angles $\alpha, \beta, \gamma$ that a vector makes with the positive $x$, $y$, $z$-axes are its **direction angles**. Their cosines $l, m, n$ are the **direction cosines**.
- Any numbers proportional to $l, m, n$ are **direction ratios**. The components $x, y, z$ themselves are direction ratios.
- $l^2 + m^2 + n^2 = 1$ always. Direction ratios don't follow this rule.

:::example{title="Direction cosines"}
For $\vec a = \hat i + 2\hat j + 2\hat k$: $|\vec a| = \sqrt{1 + 4 + 4} = 3$, so $l, m, n = \dfrac13, \dfrac23, \dfrac23$. Check: $\dfrac19 + \dfrac49 + \dfrac49 = 1$.
:::

## 3. Types of vectors

| Type | Meaning |
|---|---|
| Zero (null) $\vec 0$ | Start and end points are the same; no fixed direction |
| Unit | Magnitude 1 |
| Coinitial | Same initial point |
| Collinear | Parallel to the same line (any length, either sense) |
| Equal | Same magnitude **and** same direction |
| Negative of $\vec a$ | Same magnitude, opposite direction: $\overrightarrow{BA} = -\overrightarrow{AB}$ |

This chapter uses **free vectors**: a vector may be moved parallel to itself anywhere without changing it.

## 4. Adding vectors

- **Triangle law:** put the start of $\vec b$ at the end of $\vec a$. The third side, from the start of $\vec a$ to the end of $\vec b$, is $\vec a + \vec b$.
- The sides of a triangle taken in order add up to $\vec 0$.
- **Parallelogram law:** if $\vec a$ and $\vec b$ are two adjacent sides from the same point, the diagonal from that point is $\vec a + \vec b$. The two laws say the same thing.
- **Difference:** $\vec a - \vec b = \vec a + (-\vec b)$. In a parallelogram on $\vec a$ and $\vec b$, the other diagonal is $\vec a - \vec b$ (or $\vec b - \vec a$, going the other way).
- Addition is **commutative** and **associative**, and $\vec a + \vec 0 = \vec a$ ($\vec 0$ is the additive identity).

## 5. Multiplying by a scalar

- $\lambda\vec a$ is collinear with $\vec a$. Its length is $|\lambda|\,|\vec a|$. It points the same way if $\lambda > 0$ and the opposite way if $\lambda < 0$.
- $\vec a + (-\vec a) = \vec 0$, and $k\,\vec 0 = \vec 0$.
- For non-zero $\vec a$, the **unit vector** along it is $\hat a = \dfrac{\vec a}{|\vec a|}$.
- Distributive laws: $k\vec a + m\vec a = (k + m)\vec a$, $k(m\vec a) = (km)\vec a$, $k(\vec a + \vec b) = k\vec a + k\vec b$.

## 6. Components

- $\hat i, \hat j, \hat k$ are unit vectors along the three axes. Any vector can be written $a_1\hat i + a_2\hat j + a_3\hat k$.
- $a_1, a_2, a_3$ are the **scalar components** (also the direction ratios, and the projections on the axes). $a_1\hat i, a_2\hat j, a_3\hat k$ are the **vector components**.
- Add, subtract and scale **component by component**. Two vectors are equal only if all three components match.
- **Vector joining two points:** $\overrightarrow{P_1P_2}$ = (position vector of $P_2$) $-$ (position vector of $P_1$).
- **Collinear:** $\vec b = \lambda\vec a$, so the components are proportional: $\dfrac{b_1}{a_1} = \dfrac{b_2}{a_2} = \dfrac{b_3}{a_3}$ (if some $a_i = 0$, then $b_i = 0$ too).

:::example{title="Three points on a line"}
$A(1, -1, 2)$, $B(3, 1, 1)$, $C(7, 5, -1)$: $\overrightarrow{AB} = 2\hat i + 2\hat j - \hat k$ and $\overrightarrow{BC} = 4\hat i + 4\hat j - 2\hat k = 2\,\overrightarrow{AB}$. The two vectors are parallel and share the point $B$, so $A, B, C$ are collinear.
:::

## 7. Section formula

$P$ and $Q$ have position vectors $\vec a$ and $\vec b$.

- $R$ divides $PQ$ **internally** in the ratio $m : n$: $\vec r = \dfrac{m\vec b + n\vec a}{m + n}$.
- $R$ divides $PQ$ **externally** in the ratio $m : n$: $\vec r = \dfrac{m\vec b - n\vec a}{m - n}$ ($m \ne n$).
- Midpoint: $\dfrac{\vec a + \vec b}{2}$.

## 8. Scalar (dot) product

- $\vec a \cdot \vec b = |\vec a|\,|\vec b|\cos\theta$, where $0 \le \theta \le \pi$. The result is a **real number**.
- In components: $a_1b_1 + a_2b_2 + a_3b_3$.
- It is **commutative** ($\vec a \cdot \vec b = \vec b \cdot \vec a$) and distributes over addition. $(\lambda\vec a) \cdot \vec b = \lambda(\vec a \cdot \vec b)$.
- For non-zero vectors: $\vec a \cdot \vec b = 0$ exactly when they are **perpendicular**.
- $\theta = 0$ gives $|\vec a|\,|\vec b|$; $\theta = \pi$ gives $-|\vec a|\,|\vec b|$. In particular $\vec a \cdot \vec a = |\vec a|^2$.
- **Angle:** $\cos\theta = \dfrac{\vec a \cdot \vec b}{|\vec a|\,|\vec b|}$. For non-zero vectors, a positive dot product means $0 \le \theta < \dfrac{\pi}{2}$ (acute or zero); a negative one means $\dfrac{\pi}{2} < \theta \le \pi$ (obtuse or straight).
- **Projection** of $\vec a$ on $\vec b$ is $\vec a \cdot \hat b = \dfrac{\vec a \cdot \vec b}{|\vec b|}$. It can be negative. The projections of $\vec a$ on the $x$, $y$, $z$-axes are $a_1, a_2, a_3$.
- **Cauchy–Schwarz:** $|\vec a \cdot \vec b| \le |\vec a|\,|\vec b|$. **Triangle inequality:** $|\vec a + \vec b| \le |\vec a| + |\vec b|$. If $|\overrightarrow{AB}| + |\overrightarrow{BC}| = |\overrightarrow{AC}|$, the points $A, B, C$ are collinear.

:::example{title="Angle between two vectors"}
$\vec a = 2\hat i + \hat j - \hat k$, $\vec b = \hat i - \hat j + 2\hat k$: $\vec a \cdot \vec b = 2 - 1 - 2 = -1$ and $|\vec a| = |\vec b| = \sqrt6$.

So $\cos\theta = -\dfrac16$. The angle is obtuse: $\theta = \pi - \cos^{-1}\dfrac16 \approx 99.6^\circ$.
:::

## 9. Vector (cross) product

- **Right-handed system:** curl the fingers of the right hand from the $x$-axis towards the $y$-axis; the thumb points along the $z$-axis.
- $\vec a \times \vec b = |\vec a|\,|\vec b|\sin\theta\,\hat n$. The result is a **vector**, perpendicular to both $\vec a$ and $\vec b$, with $\vec a, \vec b, \hat n$ right-handed.
- Not commutative: $\vec b \times \vec a = -\,\vec a \times \vec b$. It does distribute over addition, and $\lambda(\vec a \times \vec b) = (\lambda\vec a) \times \vec b = \vec a \times (\lambda\vec b)$.
- For non-zero vectors: $\vec a \times \vec b = \vec 0$ exactly when they are **parallel** (collinear). So $\vec a \times \vec a = \vec 0$.
- If $\theta = \dfrac{\pi}{2}$, then $|\vec a \times \vec b| = |\vec a|\,|\vec b|$.
- In components, expand the determinant with rows $\hat i\ \hat j\ \hat k$, then $a_1\ a_2\ a_3$, then $b_1\ b_2\ b_3$. Remember the **minus sign** on the $\hat j$ term.
- **Areas:** parallelogram with adjacent sides $\vec a, \vec b$ has area $|\vec a \times \vec b|$; the triangle on the same two sides has half of it.
- A plane has two perpendicular directions, so the unit vectors perpendicular to both $\vec a$ and $\vec b$ are $\pm\dfrac{\vec a \times \vec b}{|\vec a \times \vec b|}$.

:::example{title="A cross product"}
$\vec a = 2\hat i + \hat j - \hat k$, $\vec b = \hat i - \hat j + 2\hat k$:

$\hat i$: $(1)(2) - (-1)(-1) = 1$

$\hat j$: $-\left[(2)(2) - (-1)(1)\right] = -5$

$\hat k$: $(2)(-1) - (1)(1) = -3$

So $\vec a \times \vec b = \hat i - 5\hat j - 3\hat k$. Check: its dot product with $\vec a$ is $2 - 5 + 3 = 0$, and with $\vec b$ it is $1 + 5 - 6 = 0$.
:::

## 10. Dot and cross side by side

| | Dot $\vec a \cdot \vec b$ | Cross $\vec a \times \vec b$ |
|---|---|---|
| Result | Scalar | Vector |
| Uses | $\cos\theta$ | $\sin\theta$ |
| Order | $\vec a \cdot \vec b = \vec b \cdot \vec a$ | $\vec b \times \vec a = -\vec a \times \vec b$ |
| Zero for non-zero vectors | Perpendicular | Parallel |
| Of $\hat i$ with itself | 1 | $\vec 0$ |
