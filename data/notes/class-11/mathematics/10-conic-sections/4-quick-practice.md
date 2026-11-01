---
title: "Conic Sections: Quick Practice"
type: practice
chapter: c11.mathematics.conic-sections
order: 4
---

Try each question first, then tap **Show answer**.

## Circles

:::question{title="1. Centre and radius" exam="JEE Main level"}
Find the centre and radius of $3x^2 + 3y^2 - 6x + 12y - 12 = 0$.

---

Divide by 3: $x^2 + y^2 - 2x + 4y - 4 = 0$.

$(x - 1)^2 + (y + 2)^2 = 4 + 1 + 4 = 9$.

Centre **$(1, -2)$**, radius **3**.
:::

:::question{title="2. Circle through two points" exam="JEE Main level"}
A circle passes through $(2, 0)$ and $(0, 4)$, and its centre lies on the line $y = x$. Find its equation.

---

Centre $(h, h)$. Equal distances to the two points:

$(2 - h)^2 + h^2 = h^2 + (4 - h)^2$, so $4 - 4h = 16 - 8h$ and $h = 3$.

$r^2 = (2 - 3)^2 + 3^2 = 10$. The circle is **$(x - 3)^2 + (y - 3)^2 = 10$**, that is $x^2 + y^2 - 6x - 6y + 8 = 0$.
:::

:::question{title="3. Tangent line" exam="JEE Main level"}
For which values of $c$ does the line $y = x + c$ touch the circle $x^2 + y^2 = 8$?

---

The distance from the centre $(0, 0)$ to $x - y + c = 0$ must equal the radius $2\sqrt2$:

$\dfrac{|c|}{\sqrt2} = 2\sqrt2$, so $|c| = 4$.

**$c = 4$ or $c = -4$.** (Same as $c^2 = r^2(1 + m^2) = 8 \times 2$.)
:::

## Parabolas

:::question{title="4. Parabola through a point" exam="JEE Main level"}
A parabola has its vertex at the origin, its axis along the $x$-axis, and passes through $(3, -6)$. Find its focus, directrix and length of latus rectum.

---

$x = 3 > 0$, so it opens right: $y^2 = 4ax$. Then $36 = 12a$, so $a = 3$ and the parabola is $y^2 = 12x$.

Focus **$(3, 0)$**, directrix **$x = -3$**, latus rectum **12**. (The point $(3, -6)$ is an end of the latus rectum.)
:::

:::question{title="5. Focal distance" exam="JEE Main level"}
Find the points on $y^2 = 12x$ that are at distance 7 from the focus.

---

$a = 3$. Distance from the focus = distance from the directrix $x = -3$, which is $x + 3$.

$x + 3 = 7$ gives $x = 4$, so $y^2 = 48$ and $y = \pm 4\sqrt3$.

The points are **$(4, 4\sqrt3)$ and $(4, -4\sqrt3)$**.
:::

:::question{title="6. Parabolic arch" exam="JEE Main level"}
An arch is a parabola with a vertical axis. It is 9 m high and 12 m wide at its base. How wide is it 4 m below its top?

---

Put the vertex (top) at the origin. The arch opens down: $x^2 = -4ay$.

The base ends are $(\pm 6, -9)$: $36 = 36a$, so $a = 1$ and $x^2 = -4y$.

At $y = -4$: $x^2 = 16$, so $x = \pm 4$. The width is **8 m**.
:::

## Ellipses

:::question{title="7. Reading an ellipse" exam="JEE Main level"}
Find the foci, eccentricity and length of the latus rectum of $16x^2 + 25y^2 = 400$.

---

Divide by 400: $\dfrac{x^2}{25} + \dfrac{y^2}{16} = 1$. So $a = 5$, $b = 4$, $c = \sqrt{25 - 16} = 3$.

Foci **$(\pm 3, 0)$**, $e =$ **$\dfrac35$**, latus rectum $\dfrac{2 \times 16}{5} =$ **$\dfrac{32}{5}$**.
:::

:::question{title="8. From foci and e" exam="JEE Main level"}
Find the ellipse with centre at the origin, foci $(0, \pm 4)$ and eccentricity $\dfrac23$.

---

Foci on the $y$-axis, so the form is $\dfrac{x^2}{b^2} + \dfrac{y^2}{a^2} = 1$.

$c = 4$ and $a = \dfrac{c}{e} = 6$. Then $b^2 = 36 - 16 = 20$.

The ellipse is **$\dfrac{x^2}{20} + \dfrac{y^2}{36} = 1$**.
:::

:::question{title="9. Sliding rod" exam="JEE Main level"}
A rod of length 10 cm slides with end $A$ on the $x$-axis and end $B$ on the $y$-axis. $P$ is the point on the rod with $AP = 4$ cm. Find the locus of $P$ and its eccentricity.

---

Let the rod make angle $\theta$ with the $x$-axis. $PB = 6$, so $x = 6\cos\theta$ and $y = 4\sin\theta$.

$\cos^2\theta + \sin^2\theta = 1$ gives $\dfrac{x^2}{36} + \dfrac{y^2}{16} = 1$.

$c = \sqrt{36 - 16} = 2\sqrt5$, so $e = \dfrac{2\sqrt5}{6}$. Locus **$\dfrac{x^2}{36} + \dfrac{y^2}{16} = 1$**, $e =$ **$\dfrac{\sqrt5}{3}$**.
:::

## Hyperbolas

:::question{title="10. Hyperbola through a point" exam="JEE Main level"}
A hyperbola has vertices $(\pm 4, 0)$ and passes through $(8, 3\sqrt3)$. Find its eccentricity and the length of its latus rectum.

---

Form $\dfrac{x^2}{16} - \dfrac{y^2}{b^2} = 1$. Put in the point: $\dfrac{64}{16} - \dfrac{27}{b^2} = 1$, so $\dfrac{27}{b^2} = 3$ and $b^2 = 9$.

$c^2 = 16 + 9 = 25$, so $c = 5$.

$e =$ **$\dfrac54$**, latus rectum $\dfrac{2 \times 9}{4} =$ **$\dfrac92$**.
:::
