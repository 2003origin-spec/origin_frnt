---
title: "Work, Energy and Power: Important Points and Traps"
type: key_points
chapter: c11.physics.work-energy-and-power
order: 3
---

## Work

- Work is a **scalar**, even though force and displacement are vectors. It can be positive, negative or zero.
- Work is done **by a particular force on a particular body**. NCERT calls "calculate the work done" incomplete: always say which force (or group of forces). If the question clearly means all the forces together, it is asking for the net work.
- The displacement in $W = Fd\cos\theta$ is the displacement of the point where the force acts.

:::trap
Holding a heavy bag still, or walking on a level road with it at constant speed, needs effort, but the work done **by your lifting force** on the bag is **zero**. In the first case $d = 0$; in the second the force (up) is perpendicular to the displacement (sideways).
:::

:::trap
Forces that do **no work**:
- the centripetal force in uniform circular motion (always perpendicular to velocity);
- the normal force on a body sliding on a fixed level surface;
- the tension in a simple pendulum's string (perpendicular to the bob's path).
:::

- Gravity does **negative** work on a body going up and **positive** work on a body coming down. Over a round trip back to the same height, its total work is zero.
- Kinetic friction on a body sliding over a **fixed** surface always does negative work.
- Static friction can do work. Example: a box resting on an accelerating truck is pushed forward by static friction, which does positive work on the box (in the ground frame).

:::remember
On an $F$–$x$ graph, work = area under the curve. Area **below** the $x$-axis is **negative** work. Add the signed areas.
:::

## Kinetic energy and the work-energy theorem

- KE can never be negative. Work can be.
- $W_{net}$ in the theorem is the work of **all** forces together (gravity, friction, normal force, applied force, ...).

:::trap
$K_f - K_i = W$ is a scalar equation. Do not split it into $x$ and $y$ parts.
:::

:::remember
Same momentum, different masses: $K = \dfrac{p^2}{2m}$, so the **lighter** body has more KE. Same KE: $p = \sqrt{2mK}$, so the **heavier** body has more momentum.
:::

- If the speed doubles, KE becomes **four** times. If KE doubles, speed becomes $\sqrt2$ times.
- If KE rises by 300%, it is 4 times the start, so speed doubles and momentum doubles.

## Potential energy and conservation

:::trap
$V = mgh$ is only for heights small compared with the Earth's radius ($g$ constant). For large heights the full gravitation formula is needed (Gravitation chapter).
:::

- The zero of potential energy is your choice. The **change** in PE is what is physical.
- PE can be negative, depending on where you put the zero.
- Mechanical energy is conserved only when **non-conservative** forces (friction, drag) do no work. Total energy is always conserved.

:::tip
To check whether a force is conservative, ask: does the work done round a closed loop come out zero? Kinetic friction fails this test: on a body sliding over a fixed surface it always opposes the motion, so its work round a loop is negative.
:::

- (Exam extra) Equilibrium is where $F = -dV/dx = 0$. A **minimum** of $V$ is stable, a **maximum** is unstable.

:::trap
Smooth (frictionless) slides or curved tracks, starting from rest: the speed at the bottom is $\sqrt{2gh}$ whatever the shape, but the **time** taken depends on the shape.
:::

## Spring

:::trap
The spring constant $k$ has unit **N/m**. Put $x$ in **metres**: 5 cm is 0.05 m. Errors here change $\tfrac12 kx^2$ by a factor of $10^4$.
:::

- The spring stores the same PE, $\tfrac12 kx^2$, for an extension $x$ and a compression $x$.
- Stretching from $x_1$ to $x_2$ needs work $\tfrac12 k(x_2^2 - x_1^2)$, **not** $\tfrac12 k(x_2 - x_1)^2$.
- (Exam extra) Cutting a spring into two equal halves makes each half **twice** as stiff ($2k$).

## Power

- Power tells how **fast** work is done, not how much.
- Instantaneous power $P = \vec F\cdot\vec v$. A force perpendicular to the velocity delivers zero power.
- A vehicle moving at **constant velocity** on a **level** road against a resistance $f$ needs power $P = fv$ from its engine. Going up (like NCERT's lift example), add the weight: $P = (mg + f)v$.

:::trap
kWh is a unit of **energy**. $1\ \text{kWh} = 1000\ \text{W} \times 3600\ \text{s} = 3.6\times10^6$ J. Also, 1 hp is **746 W**, not 1000 W.
:::

## Collisions

:::trap
Momentum is conserved in **every** collision (no external force). KE is conserved only in an **elastic** collision, and only when you compare before and after, not during the contact.
:::

:::remember
1-D elastic collision with $m_2$ at rest:
- equal masses: the bodies **swap** velocities;
- heavy hits light: the light one flies off at nearly $2v$;
- light hits heavy: the light one bounces back at nearly the same speed.
:::

- In a completely inelastic collision the KE loss is the **largest** possible, but the KE does not always all vanish. It is fully lost only if the total momentum is zero (equal and opposite momenta).
- For an elastic head-on collision, the two bodies move apart as fast as they came together. NCERT shows this as $v_{2f} - v_{1f} = v_{1i}$.
- (Exam extra) In general, relative speed of separation $= e \times$ relative speed of approach.
- (Exam extra) Ball dropped from height $h$ bounces back to $e^2h$.

:::tip
Elastic, equal masses, one at rest, **not** head-on: the two move off at **right angles**. Think of billiard balls.
:::

## NCERT lines to know

:::remember
- The work-energy theorem: the change in kinetic energy of a particle equals the work done on it by the net force.
- Work done by a conservative force depends only on the end points, and is zero round a closed path.
- The total mechanical energy of a system is conserved if the forces doing work on it are conservative.
- In all collisions the total linear momentum is conserved; the initial kinetic energy is not necessarily recovered.
:::
