---
title: "Motion in a Plane: Short Notes"
type: short_notes
chapter: c11.physics.motion-in-a-plane
order: 2
---

## 1. Scalars and vectors

- **Scalar:** only magnitude. Mass, time, distance, speed, work, energy, temperature.
- **Vector:** magnitude **and** direction, and it adds by the triangle law. Displacement, velocity, acceleration, force, momentum.
- Current has a direction but is a **scalar**, because currents don't add by the triangle law.

:::remember
A vector is drawn as an arrow: its length (to scale) shows the magnitude, and its head points in its direction. Moving the arrow parallel to itself does not change the vector.
:::

## 2. Kinds of vectors

| Vector | Meaning |
| --- | --- |
| Equal vectors | Same magnitude **and** same direction |
| Negative of $\vec A$ | Same magnitude, opposite direction: $-\vec A$ |
| Zero (null) vector | Magnitude 0, no definite direction; $\vec A + (-\vec A) = \vec 0$ |
| Unit vector | Magnitude 1, shows direction only: $\hat A = \vec A/A$ |
| Position vector | From the origin to the particle: $\vec r = x\hat i + y\hat j$ |
| Displacement vector | From the starting point to the final point: $\Delta\vec r = \vec r_2 - \vec r_1$ |

**Multiplying by a number:** $\lambda\vec A$ has magnitude $|\lambda| A$. For $\lambda > 0$ the direction stays; for $\lambda < 0$ it reverses.

## 3. Adding vectors

- **Triangle law:** put the tail of $\vec B$ at the head of $\vec A$; the resultant goes from the tail of $\vec A$ to the head of $\vec B$.
- **Parallelogram law:** put both tails together; the diagonal from that point is the resultant.
- **Polygon law:** for many vectors, join them head to tail; the closing side (from first tail to last head) is the resultant.
- Addition is **commutative** ($\vec A + \vec B = \vec B + \vec A$) and **associative**.
- Subtraction is adding the negative: $\vec A - \vec B = \vec A + (-\vec B)$.

## 4. Resolving a vector

Any vector in a plane can be split along any two non-parallel directions in that plane. The handiest choice is the perpendicular $x$ and $y$ axes:
$$\vec A = A_x\hat i + A_y\hat j$$
$$A_x = A\cos\theta, \qquad A_y = A\sin\theta$$

**Adding by components** (the analytical method): add the $x$-parts and the $y$-parts separately.
$$\vec R = (A_x + B_x)\hat i + (A_y + B_y)\hat j$$

:::example{title="Resultant of two forces"}
Forces of 3 N and 4 N act at right angles. $R = \sqrt{3^2 + 4^2} = 5$ N, at $\tan\alpha = 4/3$ ($\alpha \approx 53^\circ$) from the 3 N force.
:::

## 5. Motion in a plane

- **Position:** $\vec r = x\hat i + y\hat j$. **Displacement:** $\Delta\vec r = \Delta x\,\hat i + \Delta y\,\hat j$.
- **Velocity** $\vec v = d\vec r/dt$ is always **along the tangent** to the path, in the direction of motion.
- **Acceleration** $\vec a = d\vec v/dt$. Velocity and acceleration need not point the same way.
- With constant acceleration, the $x$ and $y$ motions are **independent**: solve each with the straight-line equations and combine.

## 6. Projectile motion

An object thrown into the air that moves only under gravity is a **projectile**.

Assumptions: no air resistance, and $g$ is the same (in size and direction) all along the path. The formulas for $T$ and $R$ also need it to land at the **same level** it was thrown from.

- **Horizontal:** no force, so constant velocity $u\cos\theta$.
- **Vertical:** constant acceleration $g$ downward, starting at $u\sin\theta$.
- The two together give a **parabolic** path (a straight line if it is thrown straight up or down).
- At the top, the vertical velocity is zero but the horizontal velocity $u\cos\theta$ is still there.

:::remember
Time of flight depends only on the vertical motion: $T = 2u_y/g$, where $u_y = u\sin\theta$. Range depends on both: $R = u_x \times T$, where $u_x = u\cos\theta$.
:::

**Thrown horizontally from a height:** it falls like a body dropped from that height ($t = \sqrt{2h/g}$) while moving sideways at constant speed $u$.

## 7. Uniform circular motion

Motion in a circle at **constant speed**.

- The speed is constant, but the direction keeps changing, so the velocity changes. It is **accelerated motion**.
- The acceleration $a_c = v^2/r$ points **towards the centre** (centripetal).
- Its size is constant; its direction keeps turning.
- **Angular speed** $\omega = \Delta\theta/\Delta t$ (rad/s), with $v = \omega r$.
- **Time period** $T$ = time for one revolution; **frequency** $\nu = 1/T$; $\omega = 2\pi\nu$.

:::tip
In uniform circular motion the velocity is always perpendicular to the acceleration. So the net (centripetal) force does no work, and the speed stays the same.
:::

## 8. Relative velocity

The velocity of A as seen by B is $\vec v_{AB} = \vec v_A - \vec v_B$. The current NCERT book names this idea but no longer has a section on it; NCERT Example 3.1 (below) uses it.

- **Rain and wind (NCERT Example 3.1):** rain falls straight down at 35 m/s and a 12 m/s wind blows from east to west. A boy standing still should hold his umbrella at about $19^\circ$ to the vertical ($\tan\theta = \tfrac{12}{35}$), tilted towards the east.
- **Walking in the rain (exam extra):** hold the umbrella along the velocity of rain **relative to you**, $\vec v_r - \vec v_{you}$.
- **Two projectiles thrown together (exam extra):** both fall with the same $g$, so their relative acceleration is zero. While both are in the air, each sees the other move in a **straight line** at constant velocity.
