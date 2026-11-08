---
title: "Applications of Trigonometry: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.some-applications-of-trigonometry
order: 1
---

## Values you need

| Angle | sin | cos | tan |
|---|---|---|---|
| 30° | $1/2$ | $\sqrt{3}/2$ | $1/\sqrt{3}$ |
| 45° | $1/\sqrt{2}$ | $1/\sqrt{2}$ | $1$ |
| 60° | $\sqrt{3}/2$ | $1/2$ | $\sqrt{3}$ |

:::formula{title="Decimal values"}
$$\sqrt{3} \approx 1.732$$
$$\sqrt{2} \approx 1.414$$
$$\frac{1}{\sqrt{3}} = \frac{\sqrt{3}}{3} \approx 0.577$$
Use a decimal only when the question asks for it. NCERT takes $\sqrt{3} = 1.73$ in Example 2 and $1.732$ in Example 4. Use the value the question gives: it can change the last digit ($7.4 \div 1.73 \approx 4.28$ but $7.4 \div 1.732 \approx 4.27$).
:::

## One right triangle

$h$ = height (vertical side), $d$ = distance along the ground (horizontal side), $l$ = slant length (ladder, rope, string, slide), $\theta$ = angle with the horizontal. All lengths in metres (m).

:::formula{title="Height and distance"}
$$\tan\theta = \frac{h}{d}$$
$$h = d\tan\theta$$
$$d = h\cot\theta = \frac{h}{\tan\theta}$$
Use when the height and the ground distance are involved.
:::

:::formula{title="Slant length (ladder, rope, kite string)"}
$$\sin\theta = \frac{h}{l}$$
$$\cos\theta = \frac{d}{l}$$
$\theta$ is the angle the slant line makes with the **ground**.
:::

## Observer's height

:::formula{title="Height of the object"}
$$H = e + d\tan\theta$$
$e$ = height of the observer's eye, $d$ = horizontal distance from the eye to the object, $\theta$ = angle of elevation from the eye.

The triangle starts at **eye level**, not at the ground. Add $e$ at the end.
:::

## Angle of depression

:::formula{title="Depression = elevation"}
$$\begin{aligned} &\text{depression of } B \text{ from } A \\ &= \text{elevation of } A \text{ from } B \end{aligned}$$
The two horizontal lines are parallel, so these are **alternate angles**. Put the angle inside the triangle at $B$, the point being viewed (often a point on the ground).
:::

:::formula{title="Object seen from a height"}
$$d = h\cot\theta$$
$h$ = height of the observer above the object, $\theta$ = angle of depression, $d$ = horizontal distance.
:::

## Two right triangles

:::formula{title="Two points on the same side"}
You walk $a$ metres straight towards the foot, from $A$ to $B$.
- $\beta$ = the **smaller** angle, at the **farther** point $A$.
- $\alpha$ = the **larger** angle, at the **nearer** point $B$.
- $A$, $B$ and the foot are in one straight line on level ground.
- $h$ = height of the top above the level of $A$ and $B$ (above eye level if the angles are taken from the eye).

Then
$$a = h\cot\beta - h\cot\alpha$$
$$h = \frac{a}{\cot\beta - \cot\alpha}$$
For $\beta = 30^\circ$ (far point) and $\alpha = 60^\circ$ (near point): $h = \dfrac{\sqrt{3}}{2}\,a$, and $B$ is $\dfrac{a}{2}$ from the foot.

The single formula for $h$ is a shortcut (beyond the Class 10 book). In the board exam, show the two triangles.
:::

:::formula{title="Two points on opposite sides"}
$$AB = h\cot\alpha + h\cot\beta$$
$A$ and $B$ are on opposite sides of the foot, in one line with it. $\alpha$, $\beta$ = their angles (of elevation, or of depression from the top), $h$ = height of the top.
:::

:::formula{title="Object on top of another (flagstaff, statue, tower)"}
$$\text{top part} = d\tan\alpha - d\tan\beta$$
$\beta$ = elevation of the bottom of the top part, $\alpha$ = elevation of its top, $d$ = distance from the foot.
:::

:::formula{title="Elevation and depression from a building"}
From the top of a building of height $h$: depression of the foot of a tower = $\beta$, elevation of its top = $\alpha$.
$$d = h\cot\beta$$
$$\text{tower} = h + d\tan\alpha$$
:::

## Shadows

:::formula{title="Length of a shadow"}
$$s = h\cot\theta$$
$s$ = shadow length, $h$ = height of the object, $\theta$ = Sun's altitude (angle of elevation of the Sun). A **higher** Sun gives a **shorter** shadow.
:::
