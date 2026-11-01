---
title: "Motion in a Plane: Formula Sheet"
type: formula_sheet
chapter: c11.physics.motion-in-a-plane
order: 1
---

## Vectors

:::formula{title="Magnitude and direction"}
$$|\vec A| = \sqrt{A_x^2 + A_y^2 + A_z^2}$$
In a plane, the angle $\theta$ that $\vec A$ makes with the $+x$-axis is given by $\tan\theta = \dfrac{A_y}{A_x}$. Use the signs of $A_x$ and $A_y$ to pick the quadrant: for $-3\hat i + 4\hat j$, $\theta = 127^\circ$, not $-53^\circ$.
:::

:::formula{title="Resolving a vector"}
$$A_x = A\cos\theta, \qquad A_y = A\sin\theta$$
$\theta$ is measured anticlockwise from the $+x$-axis.
:::

:::formula{title="Unit vector"}
$$\hat A = \frac{\vec A}{|\vec A|}$$
It has magnitude 1, and no unit or dimension. $\hat i, \hat j, \hat k$ point along the $+x$, $+y$, $+z$ axes.
:::

:::formula{title="Resultant of two vectors"}
$$R = \sqrt{A^2 + B^2 + 2AB\cos\theta}$$
$$\tan\alpha = \frac{B\sin\theta}{A + B\cos\theta}$$
$\theta$ = angle between $\vec A$ and $\vec B$ (tails together), $\alpha$ = angle of $\vec R$ with $\vec A$.
:::

:::formula{title="Difference of two vectors"}
$$|\vec A - \vec B| = \sqrt{A^2 + B^2 - 2AB\cos\theta}$$
:::

:::formula{title="Limits of the resultant"}
$$|A - B| \le R \le A + B$$
Maximum at $\theta = 0^\circ$, minimum at $\theta = 180^\circ$, and both ends are possible. Here $A$, $B$ and $R$ are magnitudes: $|A - B|$ is the difference of the two lengths, not $|\vec A - \vec B|$.
:::

:::formula{title="Products (used in later chapters)"}
$$\vec A\cdot\vec B = AB\cos\theta$$
$$\vec A\cdot\vec B = A_xB_x + A_yB_y + A_zB_z$$
$$|\vec A\times\vec B| = AB\sin\theta$$
:::

## Motion in a plane

:::formula{title="Position, velocity, acceleration"}
$$\vec r = x\hat i + y\hat j$$
$$\vec v = \frac{d\vec r}{dt}, \qquad \vec a = \frac{d\vec v}{dt}$$
Average velocity $= \dfrac{\Delta \vec r}{\Delta t}$, average acceleration $= \dfrac{\Delta \vec v}{\Delta t}$.
:::

:::formula{title="Constant acceleration (vector form)"}
$$\vec v = \vec v_0 + \vec a\,t$$
$$\vec r = \vec r_0 + \vec v_0\,t + \tfrac12\,\vec a\,t^2$$
Each component behaves on its own: $x = x_0 + v_{0x}t + \tfrac12 a_x t^2$, and the same for $y$.
:::

## Projectile motion

$u$ = launch speed, $\theta$ = angle above the horizontal, origin at the launch point, $y$ upward.

$T$, $R$ and the shortcuts below need the projectile to **land at the same level** it was launched from. $v_x$, $v_y$, $H$ (the rise above the launch point) and the path equation hold from any height.

:::formula{title="Velocity at time t"}
$$v_x = u\cos\theta$$
$$v_y = u\sin\theta - gt$$
$$v = \sqrt{v_x^2 + v_y^2}, \qquad \tan\phi = \frac{v_y}{v_x}$$
$\phi$ = angle of the velocity with the horizontal (below it once $v_y < 0$).
:::

:::formula{title="Time of flight"}
$$T = \frac{2u\sin\theta}{g}$$
Time to reach the top $= \dfrac{u\sin\theta}{g} = \dfrac{T}{2}$.
:::

:::formula{title="Maximum height"}
$$H = \frac{u^2\sin^2\theta}{2g}$$
The rise above the launch point.
:::

:::formula{title="Horizontal range"}
$$R = \frac{u^2\sin 2\theta}{g}$$
Maximum range $R_{max} = \dfrac{u^2}{g}$ at $\theta = 45^\circ$.
:::

:::formula{title="Equation of the path"}
$$y = x\tan\theta - \frac{g\,x^2}{2u^2\cos^2\theta}$$
A parabola. Also written as $y = x\tan\theta\left(1 - \dfrac{x}{R}\right)$.
:::

:::formula{title="Handy shortcuts (same launch and landing level)"}
$$\frac{H}{R} = \frac{\tan\theta}{4}$$
Angles $\theta$ and $90^\circ - \theta$ (same speed) give the same $R$ (this one is in NCERT). For these two angles:
$$H_1 + H_2 = \frac{u^2}{2g}$$
$$R = 4\sqrt{H_1H_2}, \qquad T_1T_2 = \frac{2R}{g}$$
The rest are derived shortcuts, not NCERT formulas.
:::

## Thrown horizontally from a height h

:::formula{title="Horizontal projection"}
$$t = \sqrt{\frac{2h}{g}}, \qquad x = u\sqrt{\frac{2h}{g}}$$
Speed on landing $= \sqrt{u^2 + 2gh}$. Path: $y = \dfrac{g\,x^2}{2u^2}$, with $x$ and $y$ measured from the point of throw ($y$ downward).
:::

## Uniform circular motion

:::formula{title="Angular speed"}
$$\omega = \frac{2\pi}{T} = 2\pi\nu, \qquad v = \omega r$$
$T$ = time period (not the time of flight above), $\nu$ = frequency (revolutions per second).
:::

:::formula{title="Centripetal acceleration"}
$$a_c = \frac{v^2}{r} = \omega^2 r = \frac{4\pi^2 r}{T^2}$$
Always towards the centre.
:::

## Exam extras (beyond the NCERT chapter; the incline is mainly for JEE)

:::formula{title="Circular motion with changing speed"}
$$a_c = \frac{v^2}{r}, \qquad a_t = \frac{dv}{dt}$$
$$a = \sqrt{a_c^2 + a_t^2}$$
$a_c$ points to the centre. $a_t$ is the rate of change of **speed**, along the tangent. The total acceleration no longer points at the centre.
:::

:::formula{title="Relative velocity"}
$$\vec v_{AB} = \vec v_A - \vec v_B$$
Velocity of A as seen from B. The current NCERT book only names relative velocity (Chapter 2) and uses it in Example 3.1 (rain and wind); the general results below are exam extras.
:::

:::formula{title="Crossing a river of width d"}
Swimmer's speed in still water $v$, river speed $u$ (this $u$ is not a launch speed). Angles are measured from the line straight across.

**Shortest time:** point yourself straight across (perpendicular to the bank). $t = \dfrac{d}{v}$, drift $= \dfrac{u\,d}{v}$.

**Zero drift** (land directly opposite, possible only if $v > u$): head upstream at $\sin\theta = \dfrac{u}{v}$. Then $t = \dfrac{d}{\sqrt{v^2 - u^2}}$.

**If $v < u$** you must drift. The shortest path heads upstream at $\sin\theta = \dfrac{v}{u}$, and the least drift is $\dfrac{d\sqrt{u^2 - v^2}}{v}$.
:::

:::formula{title="Projectile on an incline (angle α)"}
Thrown up an incline of angle $\alpha$, at angle $\theta$ to the **horizontal** ($\theta > \alpha$). $R$ is measured **along the incline**:
$$R = \frac{2u^2\cos\theta\,\sin(\theta - \alpha)}{g\cos^2\alpha}$$
$$R_{max} = \frac{u^2}{g(1 + \sin\alpha)}$$
The maximum comes at $\theta = 45^\circ + \dfrac{\alpha}{2}$.
:::
