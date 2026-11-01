---
title: "Areas Related to Circles: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.areas-related-to-circles
order: 1
---

## Symbols

$r$ = radius, $\theta$ = angle of the sector at the centre **in degrees**, $O$ = centre. Lengths in cm (or m), areas in cm² (or m²).

## The whole circle (from earlier classes)

:::formula{title="Circumference and area"}
$$C = 2\pi r$$
$$A = \pi r^2$$
$\pi \approx \dfrac{22}{7}$ or $3.14$. Use the value the question gives. NCERT's exercise says: use $\dfrac{22}{7}$ unless stated otherwise.
:::

## Sector

:::formula{title="Length of an arc"}
$$l = \frac{\theta}{360} \times 2\pi r$$
The arc of a sector of angle $\theta$. Units: same as $r$.
:::

:::formula{title="Area of a sector"}
$$A = \frac{\theta}{360} \times \pi r^2$$
$\theta$ in degrees. Units: square of the unit of $r$.
:::

:::formula{title="Quadrant and semicircle"}
$$\text{quadrant} = \frac{1}{4}\pi r^2$$
$$\text{semicircle} = \frac{1}{2}\pi r^2$$
A quadrant is a sector with $\theta = 90^\circ$. A semicircle has $\theta = 180^\circ$.
:::

:::formula{title="Major sector"}
$$\text{major sector} = \pi r^2 - \text{minor sector}$$
$$\text{major sector} = \frac{360 - \theta}{360} \times \pi r^2$$
The angle of the major sector is $360^\circ - \theta$.
:::

:::formula{title="Perimeter of a sector"}
$$P = 2r + l$$
Two radii plus the arc. (Not a boxed formula in the book: just add the pieces.)
:::

## Segment

:::formula{title="Area of a segment"}
$$\text{segment} = \text{sector } OAB - \triangle OAB$$
$$\text{segment} = \frac{\theta}{360}\pi r^2 - \text{ar}(\triangle OAB)$$
This gives the **minor** segment, with $\theta$ the angle the chord $AB$ makes at the centre.
:::

:::formula{title="Major segment"}
$$\text{major segment} = \pi r^2 - \text{minor segment}$$
The same thing: major sector **plus** $\triangle OAB$.
:::

## Area of triangle OAB

$OA = OB = r$, $\angle AOB = \theta$. Draw $OM \perp AB$. Then $M$ is the mid-point of $AB$ and $\angle AOM = \dfrac{\theta}{2}$ (NCERT's method).

:::formula{title="Using the perpendicular OM"}
$$OM = r\cos\frac{\theta}{2}$$
$$AM = r\sin\frac{\theta}{2}$$
$$\text{ar}(\triangle OAB) = \frac{1}{2} \times AB \times OM$$
Here $AB = 2\,AM$.
:::

:::formula{title="Three common angles"}
$$\text{at } 60^\circ: \ \text{ar} = \frac{\sqrt{3}}{4}r^2$$
$$\text{at } 90^\circ: \ \text{ar} = \frac{1}{2}r^2$$
$$\text{at } 120^\circ: \ \text{ar} = \frac{\sqrt{3}}{4}r^2$$
At $60^\circ$ the triangle is equilateral ($AB = r$). At $90^\circ$ it is right-angled at $O$. At $120^\circ$: $OM = \dfrac{r}{2}$ and $AB = \sqrt{3}\,r$.
:::

:::formula{title="Shortcut (beyond the Class 10 book)"}
$$\text{ar}(\triangle OAB) = \frac{1}{2}r^2\sin\theta$$
True for any $\theta$, but the Class 10 book gives sin only for angles from $0^\circ$ to $90^\circ$ (so not $\sin 120^\circ$). In the board exam, show the $OM$ and $AM$ working.
:::

## Handy angles

:::formula{title="Equal sectors and clock hands"}
$$\text{each of } n \text{ equal sectors: } \theta = \frac{360^\circ}{n}$$
$$\text{minute hand in } t \text{ min: } \theta = 6t^\circ$$
The minute hand turns $360^\circ$ in 60 minutes, so $6^\circ$ each minute.
:::
