---
title: "Motion in a Plane: Important Points and Traps"
type: key_points
chapter: c11.physics.motion-in-a-plane
order: 3
---

## Vectors

- Two vectors can be added only if they are the **same kind** of quantity. A vector and a scalar can never be added.
- A unit vector has **no unit** and no dimension. It only tells the direction.
- The **magnitude** of the resultant of $\vec A$ and $\vec B$ is always from $|A - B|$ to $A + B$, both ends included ($A$ and $B$ are the magnitudes).
- Three vectors can add up to zero only if they can form a closed triangle: each one must be no longer than the other two put together.

:::remember
- For non-zero vectors, $|\vec A + \vec B| = |\vec A - \vec B|$ means they are **perpendicular**.
- Two equal vectors whose resultant is as long as each of them are at **120°**.
- Two equal vectors of size $A$ at angle $\theta$: $R = 2A\cos(\theta/2)$.
:::

:::trap
Distance and displacement are not the same. Over one full circle, distance is $2\pi r$ but displacement is **zero**. Over half a circle, displacement is $2r$ (the diameter), not $\pi r$.
:::

## Projectile motion

:::trap
At the highest point the velocity is **not zero**. It is $u\cos\theta$, pointing horizontally. Only the vertical part is zero.
:::

:::trap
The acceleration is $g$ downward at **every** point, including the top. It is never zero during the flight.
:::

- The horizontal velocity $u\cos\theta$ never changes, because no horizontal force acts (gravity is vertical and air resistance is ignored).
- The angle between velocity and acceleration: $90^\circ + \theta$ at launch, exactly $90^\circ$ at the top, and $90^\circ - \theta$ just before landing (if it lands at the launch height).
- Kinetic energy at the top $= K\cos^2\theta$, where $K$ is the kinetic energy at launch.
- Change in momentum from launch to landing (same height) $= 2mu\sin\theta$, straight down. The horizontal momentum doesn't change.

:::tip
**Range buddies:** $\theta$ and $90^\circ - \theta$ give the **same range** at the same speed (30° and 60°, 15° and 75°). The bigger angle stays in the air longer and goes higher.
:::

:::remember
- At $45^\circ$: maximum range, and $R = 4H$.
- $R = H$ when $\tan\theta = 4$ ($\theta \approx 76^\circ$).
- Doubling the launch speed makes $T$ two times, but $H$ and $R$ **four** times.
:::

:::trap
$T = \dfrac{2u\sin\theta}{g}$ and $R = \dfrac{u^2\sin 2\theta}{g}$ only work when the projectile **lands at the same height** it started from. From a cliff, a table or onto a slope, go back to $x$ and $y$ motion separately.

$H = \dfrac{u^2\sin^2\theta}{2g}$ still gives the height risen **above the launch point**, from any height.
:::

:::trap
Check how the angle is given. If it is measured **from the vertical**, the angle from the horizontal is $90^\circ$ minus that. Use the horizontal angle in the formulas.
:::

- A ball **dropped** and a ball **thrown horizontally** from the same height land at the same time. Horizontal speed doesn't change the time of fall.
- (Exam extra) Two balls thrown at the same moment both fall with $g$, so while both are in the air each sees the other moving in a **straight line** at constant velocity.

## Uniform circular motion

:::trap
"Uniform" means the **speed** is constant, not the velocity. The direction keeps changing, so the body **is accelerating**. A net force, the centripetal force, must act on it.
:::

- The centripetal acceleration has a constant size, but it is **not a constant vector**, because its direction keeps turning.
- Velocity is along the tangent, acceleration is towards the centre, so they are always at $90^\circ$.
- Over half a revolution the velocity reverses, so the average acceleration has magnitude $\dfrac{2v}{\pi r/v} = \dfrac{2v^2}{\pi r}$. Over a full revolution it is zero.

:::trap
Convert before you use the formulas:
- rpm to rad/s: $\omega = \dfrac{2\pi \times \text{rpm}}{60}$;
- use the **radius**, not the diameter, in $a_c = v^2/r$.
:::

## Relative velocity and rivers (exam extra)

- To keep rain off, tilt the umbrella along the rain's velocity **relative to you**. If rain falls straight down and you walk forward, tilt the umbrella **forward**.
- **Shortest time** across a river: point yourself straight across (perpendicular to the bank). The flow still carries you, so you land downstream.
- **Zero drift** (land directly opposite): head upstream at an angle. This is possible only if your speed in still water is **more** than the river's speed. If it is less, some drift can't be avoided, but heading partly upstream still gives the shortest path.

:::tip
In a river problem, the time to cross depends only on the part of your velocity **across** the river. The flow only decides how far you drift.
:::

## NCERT lines to know

:::remember
- A scalar has only magnitude. A vector has magnitude and direction **and** obeys the triangle law of addition.
- The path of a projectile, with air resistance ignored, is a **parabola**.
- In uniform circular motion, the acceleration is always directed towards the centre.
:::
