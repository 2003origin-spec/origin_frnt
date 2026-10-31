---
title: "Conic Sections: Short Notes"
type: short_notes
chapter: c11.mathematics.conic-sections
order: 2
---

## 1. Sections of a cone

- Turn a line $m$ about a fixed vertical line $l$, keeping the angle $\alpha$ between them fixed. The surface is a **double-napped right circular cone**.
- $V$ is the **vertex**, $l$ the **axis**, $m$ a **generator**. The vertex splits the cone into two **nappes**.
- A **conic section** is the curve where a plane cuts the cone. Let $\beta$ be the angle between the plane and the axis.

Plane **not** through the vertex:

| Angle | Section |
|---|---|
| $\beta = 90^\circ$ | circle |
| $\alpha < \beta < 90^\circ$ | ellipse |
| $\beta = \alpha$ | parabola |
| $0 \le \beta < \alpha$ | hyperbola (cuts both nappes) |

Plane **through** the vertex (degenerate conics):

| Angle | Section |
|---|---|
| $\alpha < \beta \le 90^\circ$ | a point |
| $\beta = \alpha$ | a straight line (a generator) |
| $0 \le \beta < \alpha$ | a pair of intersecting lines |

## 2. Circle

- **Definition:** all points in a plane at a fixed distance $r$ (the radius) from a fixed point (the centre).
- Centre $(h, k)$: $(x - h)^2 + (y - k)^2 = r^2$.
- Given an expanded equation, **complete the square** in $x$ and in $y$ to read off the centre and radius.
- An equation is a circle only if the $x^2$ and $y^2$ coefficients are **equal**, there is **no $xy$ term**, and after completing the square the right side ($r^2$) is **positive**.

:::example{title="Centre and radius"}
$x^2 + y^2 - 6x + 4y - 3 = 0$

$(x^2 - 6x + 9) + (y^2 + 4y + 4) = 3 + 9 + 4$

$(x - 3)^2 + (y + 2)^2 = 16$: centre $(3, -2)$, radius 4.
:::

- **Point and circle:** compare the distance of the point from the centre with $r$. Less: inside. Equal: on. More: outside.
- A circle through three given conditions (two points and a line for the centre, as in NCERT) needs three equations in $h$, $k$, $r$.
- (Exam extra) A line meets a circle in two points, touches it, or misses it as its distance from the centre is less than, equal to, or more than $r$.

## 3. Parabola

- **Definition:** all points in a plane equally far from a fixed line (the **directrix**) and a fixed point (the **focus**) not on that line.
- If the focus lies on the directrix, the set is a straight line through the focus, perpendicular to the directrix (degenerate case).
- **Axis:** the line through the focus perpendicular to the directrix. **Vertex:** where the parabola meets its axis, halfway between focus and directrix.
- With the vertex at the origin, focus $(a, 0)$ and directrix $x = -a$ ($a > 0$), the equation is $y^2 = 4ax$.

**Reading a standard equation:**
- $y^2$ term: axis along the $x$-axis. $x^2$ term: axis along the $y$-axis.
- Opens towards the **sign of the first-degree term**: $y^2 = 8x$ opens right, $y^2 = -8x$ opens left, $x^2 = 8y$ opens up, $x^2 = -8y$ opens down.
- For $y^2 = 4ax$, $x \ge 0$ only: the curve lies in the first and fourth quadrants.

- **Latus rectum:** the chord through the focus, perpendicular to the axis. Its length is $4a$.

:::example{title="Parabola through a point"}
Vertex at the origin, symmetric about the $y$-axis, through $(2, -3)$. The point is below the $x$-axis, so it opens down: $x^2 = -4ay$.

$4 = -4a(-3)$ gives $a = \tfrac13$, so $3x^2 = -4y$.
:::

## 4. Ellipse

- **Definition:** all points in a plane whose distances from two fixed points (the **foci**) add up to a constant. The constant is **greater** than the distance between the foci.
- **Centre:** midpoint of the foci. **Major axis:** through the foci (length $2a$). **Minor axis:** through the centre, perpendicular to it (length $2b$). **Vertices:** ends of the major axis.
- Distance between the foci is $2c$. The sum of distances is $2a$ (check at a vertex).
- At an end of the minor axis, each focal distance is $\sqrt{b^2 + c^2} = a$, so $a^2 = b^2 + c^2$.
- **Eccentricity** $e = \dfrac{c}{a}$, between 0 and 1. The foci are at distance $ae$ from the centre.

**Standard equations** (centre at the origin):
- Foci on the $x$-axis: $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$, foci $(\pm c, 0)$, vertices $(\pm a, 0)$.
- Foci on the $y$-axis: $\dfrac{x^2}{b^2} + \dfrac{y^2}{a^2} = 1$, foci $(0, \pm c)$, vertices $(0, \pm a)$.
- The **larger denominator** shows the major axis.
- The ellipse is symmetric about both axes. It lies between $x = \pm a$ and $y = \pm b$ (first form) and touches these lines.
- **Latus rectum:** the chord through a focus, perpendicular to the major axis. Length $\dfrac{2b^2}{a}$.
- As $e \to 0$, $b \to a$ and the ellipse becomes a circle. As $e \to 1$, it flattens.

:::example{title="Reading an ellipse"}
$9x^2 + 4y^2 = 36$ gives $\dfrac{x^2}{4} + \dfrac{y^2}{9} = 1$. The larger denominator is under $y^2$, so $a = 3$, $b = 2$, $c = \sqrt5$.

Foci $(0, \pm\sqrt5)$, vertices $(0, \pm3)$, $e = \dfrac{\sqrt5}{3}$, latus rectum $\dfrac{8}{3}$.
:::

## 5. Hyperbola

- **Definition:** all points in a plane where the **difference** of the distances from two fixed points (the foci) is a constant. "Difference" means farther distance minus nearer distance.
- **Transverse axis:** the line through the foci. **Conjugate axis:** through the centre, perpendicular to it. **Vertices:** where the curve meets the transverse axis.
- Distance between vertices $2a$, between foci $2c$. Define $b = \sqrt{c^2 - a^2}$; $2b$ is the length of the conjugate axis.
- The constant difference is $2a$.
- **Eccentricity** $e = \dfrac{c}{a} > 1$, since $c > a$.

**Standard equations** (centre at the origin):
- Foci on the $x$-axis: $\dfrac{x^2}{a^2} - \dfrac{y^2}{b^2} = 1$, foci $(\pm c, 0)$, vertices $(\pm a, 0)$.
- Foci on the $y$-axis: $\dfrac{y^2}{a^2} - \dfrac{x^2}{b^2} = 1$, foci $(0, \pm c)$, vertices $(0, \pm a)$.
- The **positive term** shows the transverse axis, whatever the sizes of the denominators.
- Symmetric about both axes. For the first form $|x| \ge a$: no part of the curve lies between $x = -a$ and $x = a$, so it does not meet the conjugate axis.
- **Latus rectum:** through a focus, perpendicular to the transverse axis. Length $\dfrac{2b^2}{a}$.
- **Equilateral hyperbola:** $a = b$, as in $x^2 - y^2 = a^2$.

## 6. Ellipse and hyperbola side by side

| Property | Ellipse | Hyperbola |
|---|---|---|
| Focal rule | sum $= 2a$ | difference $= 2a$ |
| Relation | $c^2 = a^2 - b^2$ | $c^2 = a^2 + b^2$ |
| $e$ | $0 < e < 1$ | $e > 1$ |
| $a$ is under | larger denominator | positive term |
| Latus rectum | $2b^2/a$ | $2b^2/a$ |

| Conic | Eccentricity |
|---|---|
| Circle | $e = 0$ (beyond the syllabus) |
| Ellipse | $0 < e < 1$ |
| Parabola | $e = 1$ (beyond the syllabus) |
| Hyperbola | $e > 1$ |

## 7. Uses (NCERT miscellaneous examples)

- **Parabolic mirror or reflector:** put the vertex at the origin and the axis along the $x$-axis. $a$ is the distance from vertex to focus. A point at depth $x$ has half-width $y = \sqrt{4ax}$.
- **Arches and beams:** take the vertex at the top (or lowest point) and the axis vertical, so $x^2 = -4ay$ (or $x^2 = 4ay$). Use one known point to find $a$.
- **Semi-elliptical arch:** centre at the middle of the base, $a$ = half the width, $b$ = the height.
- **Sliding rod:** a rod has ends $A$ on the $x$-axis and $B$ on the $y$-axis. A point $P$ on it traces an ellipse: $\dfrac{x^2}{PB^2} + \dfrac{y^2}{PA^2} = 1$.

## 8. A line and a conic

- (Exam extra) The JEE Main syllabus asks for the points where a line meets a circle centred at the origin. Put $y = mx + c$ into $x^2 + y^2 = r^2$ and solve the quadratic in $x$. Two roots: two points. Equal roots: the line touches. No real roots: no meeting point.
- (Beyond the syllabus) The same "equal roots" test gives the tangency conditions for the parabola, ellipse and hyperbola listed at the end of the formula sheet. NCERT and the JEE Main 2026 syllabus do not include them.
