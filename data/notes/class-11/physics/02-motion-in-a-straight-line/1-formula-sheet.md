---
title: "Motion in a Straight Line: Formula Sheet"
type: formula_sheet
chapter: c11.physics.motion-in-a-straight-line
order: 1
---

Motion is along the $x$-axis. You choose the origin and the positive direction, and every sign follows from that choice. $x$ = position, $v$ = velocity, $a$ = acceleration, $t$ = time.

## Velocity and speed

The rationalised NCERT book no longer has a separate section on average velocity and average speed. It still uses both ideas in Section 2.2, the Summary and Exercises 2.9–2.10, and exams test them.

:::formula{title="Average velocity"}
$$\bar v = \frac{x_2 - x_1}{t_2 - t_1} = \frac{\Delta x}{\Delta t}$$
$\Delta x$ = displacement (m), $\Delta t$ = time interval (s), $\bar v$ in m/s. It has a sign: $+$ or $-$ shows the direction.
:::

:::formula{title="Average speed"}
$$\text{Average speed} = \frac{\text{path length}}{\text{time}}$$
Total path length ÷ total time. Never negative, and never less than the magnitude of the average velocity. In straight-line motion the two are equal only if the body does not turn back.
:::

:::formula{title="Instantaneous velocity"}
$$v = \lim_{\Delta t \to 0}\frac{\Delta x}{\Delta t} = \frac{dx}{dt}$$
The slope of the tangent to the $x$–$t$ graph at that instant. **Speed** = $|v|$ at that instant.
:::

## Acceleration

:::formula{title="Average acceleration"}
$$\bar a = \frac{v_2 - v_1}{t_2 - t_1} = \frac{\Delta v}{\Delta t}$$
SI unit m/s² (m s⁻²).
:::

:::formula{title="Instantaneous acceleration"}
$$a = \frac{dv}{dt} = \frac{d^2x}{dt^2}$$
The slope of the tangent to the $v$–$t$ graph.
:::

:::formula{title="What the graphs give"}
Slope of $x$–$t$ graph = velocity.

Slope of $v$–$t$ graph = acceleration.

Area under $v$–$t$ graph = displacement (area below the time axis counts as negative).

Area under $a$–$t$ graph = change in velocity (from $a = dv/dt$; exam extra).
:::

## Kinematic equations (constant acceleration only)

$v_0$ = velocity at $t = 0$, $v$ = velocity at time $t$ (both m/s), $a$ = acceleration (m/s²), $t$ = time (s), $x_0$ = position at $t = 0$, $x$ = position at time $t$ (both m). NCERT first takes $x_0 = 0$ (Eq. 2.9a), so $x - x_0$ is just $x$; then it gives the general form below (Eq. 2.9b).

:::formula{title="First equation"}
$$v = v_0 + at$$
:::

:::formula{title="Second equation"}
$$x - x_0 = v_0t + \tfrac12 at^2$$
:::

:::formula{title="Third equation"}
$$v^2 = v_0^2 + 2a(x - x_0)$$
:::

:::formula{title="Displacement from average velocity"}
$$x - x_0 = \frac{v_0 + v}{2}\,t$$
$\dfrac{v_0 + v}{2}$ is the average velocity **only when $a$ is constant**.
:::

:::trap
These equations need **constant acceleration** (magnitude and direction). If $a$ changes with time, position or velocity, use calculus instead. $x - x_0$ is the **displacement**, not the distance. If the body turns back, they differ.
:::

## Free fall (no air resistance)

NCERT sign choice: **upward is positive**, so $a = -g$, with $g = 9.8$ m/s² (often taken as 10 m/s² in problems).

:::formula{title="Thrown straight up with speed u"}
$$t_{up} = \frac{u}{g}$$
$$H = \frac{u^2}{2g}$$
Total time to come back to the hand $= \dfrac{2u}{g}$. It returns with the same speed $u$, moving down. $u$ in m/s; $H$ (m) = height above the point of throw.
:::

:::formula{title="Dropped from rest, height h"}
$$t = \sqrt{\frac{2h}{g}}$$
$$v = \sqrt{2gh}$$
$h$ in m, $t$ in s, $v$ in m/s: speed on reaching the ground. Same time and speed for any mass.
:::

:::formula{title="Galileo's law of odd numbers"}
$$s_1 : s_2 : s_3 : \dots = 1 : 3 : 5 : \dots$$
Distances covered in **successive equal time intervals** by a body starting **from rest** with constant acceleration. NCERT (Example 2.5) proves it for free fall. Total distances after $1, 2, 3, \dots$ intervals go as $1 : 4 : 9 : \dots$ ($\propto n^2$).
:::

## Stopping distance and reaction time

:::formula{title="Stopping (braking) distance"}
$$d_s = \frac{v_0^2}{2a}$$
$v_0$ = speed when the brakes act (m/s), $a$ = **magnitude** of the steady deceleration (m/s²), $d_s$ in m. Doubling the speed makes $d_s$ four times (same deceleration). NCERT (Example 2.6) writes $d_s = -v_0^2/2a$, with $a$ negative; it is the same thing.
:::

:::formula{title="Reaction time from a falling ruler"}
$$t_r = \sqrt{\frac{2d}{g}}$$
$d$ = distance the ruler falls before it is caught (m), $t_r$ in s. The ruler starts from rest and falls freely (NCERT Example 2.7).
:::

## Relative velocity (exam extra)

The rationalised NCERT text has no relative-velocity section any more, but JEE Main and NEET still test it, and NCERT Exercise 2.14 needs it.

:::formula{title="Velocity of B relative to A"}
$$v_{BA} = v_B - v_A$$
$$v_{AB} = v_A - v_B = -v_{BA}$$
All in m/s. Signs come from your positive direction. Same direction: relative speed $= |v_B - v_A|$. Opposite directions: relative speed = the sum of the two speeds.
:::

:::formula{title="Separation of two bodies (uniform velocities)"}
$$\begin{aligned} x_B(t) - x_A(t) &= [x_B(0) - x_A(0)] \\ &\quad + (v_B - v_A)\,t \end{aligned}$$
If $v_A = v_B$, the gap stays constant: their $x$–$t$ lines are parallel.
:::

## Calculus form (works for changing acceleration too)

:::formula{title="Acceleration in terms of position"}
$$a = v\,\frac{dv}{dx}$$
From $a = \dfrac{dv}{dt} = \dfrac{dv}{dx}\dfrac{dx}{dt}$. NCERT uses it in Example 2.2 to derive $v^2 = v_0^2 + 2a(x - x_0)$. Use it when $a$ is given in terms of $x$.
:::

:::formula{title="Velocity and position by integration"}
$$v = v_0 + \int_0^t a\,dt$$
$$x = x_0 + \int_0^t v\,dt$$
NCERT Example 2.2 notes that the calculus method also works when the acceleration is **not** uniform.
:::

## Exam extras (not in the NCERT text)

:::formula{title="Displacement in the nth second"}
$$s_n = v_0 + \frac{a}{2}(2n - 1)$$
Constant acceleration only. It equals $x(n) - x(n-1)$, the displacement during the $n$th second, in metres (a hidden "× 1 s" fixes the units). It equals the distance only if the body does not turn back during that second.
:::

:::formula{title="Average speed over two parts"}
Equal **distances** at speeds $v_1$ and $v_2$:
$$v_{av} = \frac{2v_1v_2}{v_1 + v_2}$$
Equal **times** at speeds $v_1$ and $v_2$:
$$v_{av} = \frac{v_1 + v_2}{2}$$
:::
