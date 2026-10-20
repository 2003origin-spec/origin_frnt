---
title: "Conic Sections: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.conic-sections
order: 1
---

## Circle

:::formula{title="Centre-radius form"}
$$(x - h)^2 + (y - k)^2 = r^2$$
Centre $(h, k)$, radius $r > 0$. Centre at the origin: $x^2 + y^2 = r^2$.
:::

:::formula{title="General form (exam extra)"}
In the JEE Main syllabus, not in NCERT.
$$x^2 + y^2 + 2gx + 2fy + c = 0$$
Centre $(-g, -f)$, and
$$r = \sqrt{g^2 + f^2 - c}$$
A real circle only when $g^2 + f^2 - c > 0$ ($= 0$ gives a single point). The $x^2$ and $y^2$ coefficients must be equal (divide to make both 1), and there must be no $xy$ term. NCERT gets the centre and radius by completing the square.
:::

:::formula{title="Diameter form (exam extra)"}
In the JEE Main syllabus, not in NCERT. Ends of a diameter $(x_1, y_1)$ and $(x_2, y_2)$:
$$(x - x_1)(x - x_2) + (y - y_1)(y - y_2) = 0$$
:::

:::formula{title="Line touching x² + y² = r² (exam extra)"}
The JEE Main syllabus includes where a line meets a circle centred at the origin. The line $y = mx + c$ touches the circle when
$$c^2 = r^2\,(1 + m^2)$$
This is the same as: distance of the line from the centre $= r$. Distance less than $r$: two points; more than $r$: none.
:::

## Parabola (vertex at the origin, $a > 0$)

| Equation | Focus | Directrix | Opens |
|---|---|---|---|
| $y^2 = 4ax$ | $(a, 0)$ | $x = -a$ | right |
| $y^2 = -4ax$ | $(-a, 0)$ | $x = a$ | left |
| $x^2 = 4ay$ | $(0, a)$ | $y = -a$ | up |
| $x^2 = -4ay$ | $(0, -a)$ | $y = a$ | down |

:::formula{title="Latus rectum"}
$$\text{Length} = 4a$$
For $y^2 = 4ax$ its ends are $(a, 2a)$ and $(a, -2a)$. $a$ = distance from vertex to focus.
:::

:::formula{title="Focal distance (from the definition)"}
For a point $(x_1, y_1)$ on $y^2 = 4ax$:
$$PF = x_1 + a$$
It equals the distance from $P$ to the directrix.
:::

## Ellipse ($a > b > 0$)

:::formula{title="Standard forms"}
Major axis along the $x$-axis:
$$\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1$$
Major axis along the $y$-axis:
$$\frac{x^2}{b^2} + \frac{y^2}{a^2} = 1$$
$a^2$ is always the **larger** denominator; $a$ is the semi-major axis.
:::

:::formula{title="a, b, c and e"}
$$c^2 = a^2 - b^2$$
$$e = \frac{c}{a}$$
Here $0 < e < 1$.
$$b^2 = a^2(1 - e^2)$$
$c$ = distance from centre to each focus ($c = ae$).
:::

:::formula{title="Lengths"}
Major axis $2a$, minor axis $2b$, between foci $2c$.
$$\text{Latus rectum} = \frac{2b^2}{a}$$
:::

:::formula{title="Sum of focal distances"}
$$PF_1 + PF_2 = 2a$$
For $\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1$ with $F_1(-c, 0)$, $F_2(c, 0)$: $PF_1 = a + ex$ and $PF_2 = a - ex$.
:::

## Hyperbola

:::formula{title="Standard forms"}
Transverse axis along the $x$-axis:
$$\frac{x^2}{a^2} - \frac{y^2}{b^2} = 1$$
Transverse axis along the $y$-axis:
$$\frac{y^2}{a^2} - \frac{x^2}{b^2} = 1$$
$a^2$ is under the **positive** term. $b$ may be larger than $a$.
:::

:::formula{title="a, b, c and e"}
$$c^2 = a^2 + b^2$$
$$e = \frac{c}{a}$$
Here $e > 1$, since $c > a$.
$$b^2 = a^2(e^2 - 1)$$
:::

:::formula{title="Lengths"}
Transverse axis $2a$, conjugate axis $2b$, between foci $2c$.
$$\text{Latus rectum} = \frac{2b^2}{a}$$
:::

:::formula{title="Difference of focal distances"}
$$|PF_1 - PF_2| = 2a$$
(farther focus minus nearer focus).
:::

:::formula{title="Equilateral hyperbola"}
$a = b$:
$$x^2 - y^2 = a^2$$
Then $c = a\sqrt2$, so $e = \sqrt2$.
:::

## Beyond the syllabus (quick aids only)

Not in NCERT and not named in the JEE Main 2026 syllabus. Learn the NCERT formulas above first.

:::formula{title="Directrices of an ellipse or hyperbola"}
Foci on the $x$-axis:
$$x = \pm\frac{a}{e}$$
Foci on the $y$-axis: $y = \pm\dfrac{a}{e}$. Then $PF = e \times PM$, where $PM$ is the distance from $P$ to the directrix on the same side as the focus $F$. The parabola is the case $e = 1$. A circle has no directrix.
:::

:::formula{title="Tangency conditions for y = mx + c"}
Parabola $y^2 = 4ax$ ($m \ne 0$):
$$c = \frac{a}{m}$$
Ellipse $\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1$:
$$c^2 = a^2 m^2 + b^2$$
Hyperbola $\frac{x^2}{a^2} - \frac{y^2}{b^2} = 1$ (needs $|m| > b/a$):
$$c^2 = a^2 m^2 - b^2$$
Each comes from putting $y = mx + c$ into the curve and making the discriminant 0. Here $c$ is the line's intercept, not the focal distance.
:::

:::formula{title="Asymptotes"}
For $\frac{x^2}{a^2} - \frac{y^2}{b^2} = 1$:
$$y = \pm\frac{b}{a}\,x$$
For $\frac{y^2}{a^2} - \frac{x^2}{b^2} = 1$: $\;y = \pm\dfrac{a}{b}\,x$.
:::
