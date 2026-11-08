---
title: "Motion in a Straight Line: Short Notes"
type: short_notes
chapter: c11.physics.motion-in-a-straight-line
order: 2
---

## 1. Setting up the problem

- This chapter studies **rectilinear motion**: motion along a straight line. The moving body is treated as a **point object**.
- Pick an **origin** and a **positive direction** on the line (the $x$-axis). Position $x$ is then $+$ or $-$.
- The choice of origin, positive direction and the zero of time is yours. The physics does not change, but you must use the same choice all through one problem.
- **Displacement** $\Delta x = x_2 - x_1$ can be $+$, $-$ or zero. **Path length** (distance) is the total length actually travelled, and is never negative.

## 2. Average velocity and average speed

The rationalised NCERT book dropped the separate section on these, but uses them in Section 2.2, the Summary and Exercises 2.9–2.10. Exams still test them.

- **Average velocity** = displacement ÷ time interval. It depends only on the start and end points.
- **Average speed** = total path length ÷ time interval.
- If the body turns back, the path length is more than the size of the displacement. So average speed > |average velocity|.

:::example{title="Going and coming back"}
A car goes 40 m forward in 4 s and comes back 40 m in 4 s. Displacement = 0, so average velocity = 0. Path length = 80 m, so average speed = 80/8 = 10 m/s.
:::

## 3. Instantaneous velocity and speed

- **Instantaneous velocity** $v = dx/dt$: the limit of average velocity as $\Delta t \to 0$.
- On an $x$–$t$ graph it is the **slope of the tangent** at that point.
- **Instantaneous speed** is the magnitude of instantaneous velocity. Over a tiny interval the body cannot turn back, so speed $= |v|$ at every instant. (This is not true for **averages** over a long interval.)

| $x$–$t$ graph | Motion |
| --- | --- |
| Horizontal line | At rest |
| Straight sloping line | Uniform velocity |
| Curve, slope increasing | Velocity increasing ($a > 0$) |
| Curve, slope decreasing | Velocity decreasing ($a < 0$) |

## 4. Acceleration

- **Average acceleration** = $\Delta v / \Delta t$. **Instantaneous acceleration** $a = dv/dt$, the slope of the $v$–$t$ graph.
- Unit: m/s². Acceleration is a vector; in one dimension its sign gives its direction.
- **Uniform acceleration**: $a$ is constant, so the $v$–$t$ graph is a straight line and the $x$–$t$ graph is a parabola.

**Speeding up or slowing down?** Compare the signs of $v$ and $a$.

| $v$ | $a$ | Speed |
| --- | --- | --- |
| $+$ | $+$ | Increases |
| $-$ | $-$ | Increases |
| $+$ | $-$ | Decreases |
| $-$ | $+$ | Decreases |

:::remember
The sign of $a$ alone does **not** tell you if the body is speeding up. Same signs of $v$ and $a$: speeding up. Opposite signs: slowing down.
:::

- $v = 0$ at an instant does not mean $a = 0$. A ball at the top of its flight has $v = 0$ but $a = -g$.

## 5. The v–t graph

- Slope = acceleration.
- **Area** between the graph and the time axis = **displacement**. Area below the axis is negative.
- For distance, add all the areas as positive numbers.
- For uniform acceleration from $v_0$ to $v$ in time $t$, the area is a trapezium: $\tfrac12(v_0 + v)t$. Put $v = v_0 + at$ and you get the second kinematic equation.

## 6. Kinematic equations

For **constant** acceleration (NCERT takes $x = 0$ at $t = 0$):
$$v = v_0 + at$$
$$x = v_0t + \tfrac12 at^2$$
$$v^2 = v_0^2 + 2ax$$

- They come from the $v$–$t$ graph (area and slope), or by calculus (NCERT Example 2.2): integrate $a = dv/dt$ and $v = dx/dt$, and use $a = v\,dv/dx$ for the third one. NCERT shows both ways.
- They hold for positive and negative $a$. Put every quantity in with its sign.
- If the start is at $x_0$ (not zero), replace $x$ by $x - x_0$.

:::tip
Choose the equation by the missing quantity. No $x$: first. No $v$: second. No $t$: third.
:::

## 7. Free fall

- A body moving only under gravity, near the earth, with air resistance ignored, has constant acceleration $g = 9.8$ m/s² **downward**.
- NCERT takes **upward as positive**, so $a = -g$. Then $v = -gt$, $y = -\tfrac12 gt^2$ and $v^2 = -2gy$ for a body dropped from rest at $y = 0$. The negative $y$ just means "below the start".
- Free fall does not depend on the mass of the body.

**Thrown straight up with speed $u$:**
- It slows down at $g$, stops at the top ($v = 0$, but $a = -g$), then speeds up downward.
- Time up = time down $= u/g$ (back to the same level).
- It passes every point with the same speed going up and coming down.

## 8. Three NCERT examples

- **Galileo's law of odd numbers (Example 2.5):** from rest with constant acceleration, distances in successive equal time intervals are in the ratio $1 : 3 : 5 : 7 : \dots$
- **Stopping distance (Example 2.6):** the distance a vehicle goes **after the brakes are applied**. At speed $v_0$ with a steady deceleration of size $a$, $d_s = v_0^2/2a$. It grows as the **square** of the speed, which is why speed limits matter.
- **Reaction time (Example 2.7):** drop a ruler between someone's fingers. If it falls $d$ before they catch it, their reaction time is $t_r = \sqrt{2d/g}$. For $d = 21$ cm and $g = 9.8$ m/s², $t_r \approx 0.21$ s.

:::tip
(Exam extra) Problems often ask for the distance from **seeing** the danger to stopping. That is $v_0 t_r$ (constant speed during the reaction time) + the braking distance $v_0^2/2a$. NCERT's "stopping distance" is only the braking part.
:::

## 9. Relative velocity (exam extra)

The rationalised NCERT text no longer has this section, but JEE Main and NEET still test it, and NCERT Exercise 2.14 needs it.


- The velocity of B as seen from A is $v_{BA} = v_B - v_A$. Also $v_{AB} = -v_{BA}$.
- **Same direction:** relative speed is the difference of the speeds. **Opposite directions:** it is the sum.
- With uniform velocities, the gap between A and B changes at the steady rate $v_B - v_A$.

| Case (on $x$–$t$ graphs) | What happens |
| --- | --- |
| $v_A = v_B$ | Parallel lines; the gap never changes |
| $v_A \ne v_B$ | Lines cross once; that is where they meet |
| Gap shrinking | They meet later, then move apart |
| Gap growing | They never meet after $t = 0$ |

:::example{title="Meeting of two cars"}
Two cars 300 m apart move towards each other at 10 m/s and 20 m/s. Relative speed $= 30$ m/s, so they meet after $300/30 = 10$ s.
:::
