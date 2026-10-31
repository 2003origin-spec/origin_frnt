---
title: "Motion in a Straight Line: Important Points and Traps"
type: key_points
chapter: c11.physics.motion-in-a-straight-line
order: 3
---

## Distance, displacement, velocity

- Displacement can be positive, negative or zero. Distance (path length) is never negative.
- $|\text{displacement}| \le \text{distance}$. They are equal only if the body moves in one direction without turning back.
- Average speed $\ge$ |average velocity|. Over a round trip, average velocity is **zero** but average speed is not.
- Instantaneous speed is always equal to |instantaneous velocity|. This equality does **not** hold for the averages.

:::trap
When the body **turns back**, find the time when $v = 0$ first. Work out the distance before and after that instant separately and add. Putting the total time into $x = v_0t + \tfrac12at^2$ gives the **displacement**, not the distance.
:::

:::trap
(Exam extra) Average speed over two equal **distances** is **not** $\dfrac{v_1 + v_2}{2}$. It is $\dfrac{2v_1v_2}{v_1 + v_2}$. Always use total distance ÷ total time.
:::

## Acceleration and its sign

:::trap
Negative acceleration does **not** always mean slowing down. With $v < 0$ and $a < 0$, the body speeds up in the negative direction. Look at whether $v$ and $a$ have the same sign or opposite signs.
:::

:::trap
Zero velocity does **not** mean zero acceleration. At the top of a vertical throw, $v = 0$ but $a = g$ downward. That is why the ball comes back down.
:::

- A body can have zero acceleration with a large velocity (uniform motion), and non-zero acceleration at the instant its velocity is zero.
- "Deceleration" or "retardation" of 5 m/s² means the **magnitude**. Put it in the equations with the sign opposite to $v$.

## Graphs

- An $x$–$t$ graph can never be **vertical** (infinite speed) and can never give **two positions** at one time.
- A $v$–$t$ graph cannot have a vertical jump either, because that needs infinite acceleration. In problems, a sudden change is an idealisation.
- Speed can never be negative, so a speed–time graph never goes below the time axis. A velocity–time graph can.
- Where an $x$–$t$ graph crosses the time axis, the body is at the origin, not at rest. At rest means the slope is zero.

:::trap
Area under a $v$–$t$ graph gives **displacement** when you keep the sign (area below the axis is negative). For **distance**, add the sizes of all the areas.
:::

## Kinematic equations

:::trap
$v = v_0 + at$, $x = v_0t + \tfrac12at^2$ and $v^2 = v_0^2 + 2ax$ hold **only for constant acceleration**. If $a$ depends on $t$, $x$ or $v$, use $a = dv/dt$ or $a = v\,dv/dx$ and integrate.
:::

- Average velocity $= \dfrac{v_0 + v}{2}$ **only** for constant acceleration.
- Keep one sign convention for the whole problem. Write $v_0$, $a$ and $x$ with their signs.
- (Exam extra) $s_n = v_0 + \tfrac{a}{2}(2n - 1)$ is the displacement in the $n$th second. It looks like it has the wrong unit, but a hidden "× 1 s" makes it metres.

## Free fall

- With no air resistance, all bodies fall with the same acceleration $g$, whatever their mass.
- Thrown up with speed $u$: time up = time down $= u/g$, and it comes back to the hand at speed $u$.
- At any height, the speed going up equals the speed coming down.

:::trap
A packet dropped from a **moving** balloon, lift or helicopter is not "dropped from rest". It starts with the velocity of the balloon. From a balloon rising at 5 m/s, the packet first moves **up** at 5 m/s, then falls.
:::

:::trap
With upward positive (NCERT), $a = -g$ even when the body is going up. The acceleration of a freely falling body is always downward. Only the velocity changes direction.
:::

:::tip
**Odd numbers 1, 3, 5, 7:** from rest, distances in the 1st, 2nd, 3rd... seconds of free fall ($g = 10$ m/s²) are 5, 15, 25, 35 m. Total after 1, 2, 3 s: 5, 20, 45 m.
:::

## Stopping distance and reaction time

- Braking distance $\propto v_0^2$. Double the speed, four times the braking distance.
- NCERT's stopping distance is the distance **after** the brakes are applied.
- (Exam extra) During the reaction time the car moves at **constant speed**: distance $= v_0 t_r$. Braking starts only after that.

## Relative velocity (exam extra)

- $v_{BA} = v_B - v_A$ is the velocity of **B as seen from A**. Mixing up the order flips the sign.
- Overtaking or crossing trains: relative distance = sum of their lengths (plus any gap).
- Same direction: subtract speeds. Opposite directions: add speeds.

:::tip
In a chase or meeting problem, sit on one body. It is now at rest, and the other moves at the relative velocity. Then time = gap ÷ relative speed.
:::

## NCERT points to know (in our words)

:::remember
- The origin and the positive direction of the axis are a matter of choice. Fix them before giving signs to $x$, $v$ and $a$.
- Speeding up: acceleration is along the velocity. Slowing down: it is opposite to the velocity.
- The sign of acceleration does not tell us whether the speed of a body is increasing or decreasing.
- The area under the velocity–time curve gives the displacement over that time interval.
- The kinematic equations hold only when both the magnitude and the direction of the acceleration stay constant.
- A body can have zero velocity and still have a non-zero acceleration at that instant.
:::
