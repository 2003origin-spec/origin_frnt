---
title: "Laws of Motion: Formula Sheet"
type: formula_sheet
chapter: c11.physics.laws-of-motion
order: 1
---

All formulas here are for motion seen from the ground (or any frame moving at constant velocity relative to it), unless a box says otherwise. Exam books call such a frame an **inertial frame**; the current NCERT chapter does not use the term. NCERT uses $g = 9.8$ m/s² in its text (and $g = 10$ m/s² in some examples and the exercises).

## Momentum and Newton's second law

:::formula{title="Linear momentum"}
$$\vec p = m\vec v$$
$m$ = mass (kg), $\vec v$ = velocity (m/s). Unit of $p$: kg m/s (same as N s). A vector, along $\vec v$.
:::

:::formula{title="Second law (general form)"}
$$\vec F = \frac{d\vec p}{dt}$$
$\vec F$ = **net external** force (N). The rate of change of momentum is along the net force.
:::

:::formula{title="Second law (constant mass)"}
$$\vec F = m\vec a$$
Only when $m$ does not change. $1\text{ N} = 1\text{ kg m s}^{-2}$. Works for each axis on its own:
$$F_x = m a_x$$
$$F_y = m a_y$$
For a body or system, $\vec F$ is the total external force and $\vec a$ is the acceleration of the body as a whole (its centre of mass).
:::

## Impulse

:::formula{title="Impulse (NCERT form)"}
$$\vec J = \vec F\,\Delta t$$
$$\vec J = \Delta\vec p$$
$\vec J$ = impulse (N s), $\Delta t$ = time the force acts (s), $\Delta\vec p = m\vec v - m\vec u$. Exact for a constant force; for a short, large (impulsive) force, $\vec F$ is the average force. The symbol $J$ is not NCERT's; NCERT just writes "impulse".
:::

:::formula{title="Impulse of a varying force (exam extra, not in NCERT)"}
$$\vec J = \int \vec F\,dt$$
For one-dimensional motion, $J$ = area under the force–time graph. It still equals $\Delta p$. Average force:
$$F_{avg} = \frac{\Delta p}{\Delta t}$$
:::

## Third law and conservation of momentum

:::formula{title="Third law"}
$$\vec F_{AB} = -\vec F_{BA}$$
$\vec F_{AB}$ = force **on A by B**. The pair acts on **different** bodies, at the same instant.
:::

:::formula{title="Conservation of momentum"}
$$m_1\vec u_1 + m_2\vec u_2 = m_1\vec v_1 + m_2\vec v_2$$
Only when the **net external force** on the system is zero (an isolated system). Internal forces cannot change the total momentum.
:::

:::formula{title="Recoil of a gun"}
$$\vec V = -\frac{m}{M}\vec v$$
Gun (mass $M$) and bullet (mass $m$) start at rest. $\vec v$ = bullet velocity, $\vec V$ = gun velocity (opposite to the bullet).
:::

## Equilibrium of a particle

:::formula{title="Equilibrium"}
$$\vec F_1 + \vec F_2 + \dots + \vec F_n = 0$$
Each component must be zero: $\sum F_x = 0$, $\sum F_y = 0$, $\sum F_z = 0$. Three forces in equilibrium form a closed triangle.
:::

:::formula{title="Lami's theorem (exam extra, not in NCERT)"}
$$\frac{F_1}{\sin\alpha} = \frac{F_2}{\sin\beta}$$
$$\frac{F_2}{\sin\beta} = \frac{F_3}{\sin\gamma}$$
Three **concurrent** forces in equilibrium. $\alpha$ is the angle between $F_2$ and $F_3$ (opposite $F_1$), and so on.
:::

## Common forces

:::formula{title="Weight"}
$$W = mg$$
Acts vertically down. Mass is in kg, weight in N.
:::

:::formula{title="Normal reaction (simple cases)"}
Horizontal floor, no other vertical force, and no vertical acceleration: $N = mg$. (In an accelerating lift, $N \ne mg$.)

Smooth or rough incline of angle $\theta$, nothing pressing on the block: $N = mg\cos\theta$.

In other cases, find $N$ from the forces perpendicular to the surface. It is **not** always $mg$.
:::

:::formula{title="Static friction"}
$$f_s \le \mu_s N$$
$$f_{s,max} = \mu_s N$$
$\mu_s$ = coefficient of static friction (no unit). $f_s$ adjusts itself to stop sliding, up to the limit.
:::

:::formula{title="Kinetic friction"}
$$f_k = \mu_k N$$
Acts only while surfaces **slide** on each other. Nearly independent of speed and of the area of contact. Usually $\mu_k < \mu_s$.
:::

:::formula{title="Angle of repose"}
$$\tan\theta_{max} = \mu_s$$
$\theta_{max}$ = largest incline angle at which a block stays at rest (NCERT Example 4.8). Independent of the block's mass. Many books call it the angle of repose; NCERT just writes $\theta_{max}$.
:::

## Blocks, lifts and pulleys

These set-ups are in NCERT's exercises and examples (lift: Ex. 4.13; pulley: Ex. 4.16; string-tied blocks: Ex. 4.15; block and trolley: Example 4.9). NCERT solves them with free-body diagrams; the boxed results below are derived from $F = ma$ and are not printed in the book. Learn the method, not just the result.

:::formula{title="Block sliding down a rough incline"}
$$a = g(\sin\theta - \mu_k\cos\theta)$$
Only if it is sliding ($\tan\theta > \mu_s$ to start). Smooth incline: $a = g\sin\theta$.
:::

:::formula{title="Block pushed up, sliding up"}
$$a = g(\sin\theta + \mu_k\cos\theta)$$
This is the **retardation** (it slows down) while it moves up, with no applied force.
:::

:::formula{title="Apparent weight in a lift"}
$$R = m(g + a)$$
Lift accelerating **upward** at $a$ (moving up and speeding up, or moving down and slowing down).
$$R = m(g - a)$$
Lift accelerating **downward** at $a$. Free fall ($a = g$): $R = 0$. Constant velocity: $R = mg$.
:::

:::formula{title="Atwood machine"}
$$a = \frac{(m_1 - m_2)g}{m_1 + m_2}$$
$$T = \frac{2m_1m_2\,g}{m_1 + m_2}$$
Two masses ($m_1 > m_2$) hang over a light, frictionless pulley on a light, inextensible string.
:::

:::formula{title="Two blocks pushed together"}
$$a = \frac{F}{m_1 + m_2}$$
$$N_{12} = \frac{m_2F}{m_1 + m_2}$$
Smooth floor. $F$ pushes $m_1$, which pushes $m_2$. $N_{12}$ = contact force between them.
:::

:::formula{title="Pseudo force (exam extra, not in NCERT)"}
$$\vec F_{pseudo} = -m\vec a_0$$
Only when you solve in a frame accelerating at $\vec a_0$. Not needed in an inertial frame.
:::

## Circular motion

:::formula{title="Centripetal force"}
$$f_c = \frac{mv^2}{r}$$
$$f_c = m\omega^2 r$$
$r$ = radius (NCERT writes $R$), $\omega$ = angular speed (rad/s). Points to the centre. It is **not a new force**: tension, friction, gravity or a normal force supplies it.
:::

:::formula{title="Car on a level road"}
$$v_{max} = \sqrt{\mu_s r g}$$
Static friction alone gives the centripetal force. Does not depend on the car's mass.
:::

:::formula{title="Banked road, no friction needed"}
$$v_o = \sqrt{r g\tan\theta}$$
$\theta$ = banking angle. At this speed the normal force alone supplies the centripetal force.
:::

:::formula{title="Banked road, maximum speed"}
$$v_{max} = \sqrt{\frac{r g(\mu_s + \tan\theta)}{1 - \mu_s\tan\theta}}$$
Friction acts **down** the slope. Valid when $\mu_s\tan\theta < 1$. Put $\mu_s = 0$ to get $v_o$.
:::

:::formula{title="Banked road, minimum speed (exam extra)"}
$$v_{min} = \sqrt{\frac{r g(\tan\theta - \mu_s)}{1 + \mu_s\tan\theta}}$$
Friction acts **up** the slope. If $\mu_s \ge \tan\theta$, the car can stand still on the bank, so there is no lower limit.
:::
