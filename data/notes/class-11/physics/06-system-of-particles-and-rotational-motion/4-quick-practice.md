---
title: "Rotational Motion: Quick Practice"
type: practice
chapter: c11.physics.system-of-particles-and-rotational-motion
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Centre of mass

:::question{title="1. Two masses on a line" exam="NEET level"}
A 2 kg mass is at $x = 0$ and a 3 kg mass is at $x = 5$ m. Where is their centre of mass?

---

$X = \dfrac{2 \times 0 + 3 \times 5}{2 + 3} = \dfrac{15}{5} =$ **3 m** from the origin, closer to the heavier 3 kg mass.
:::

:::question{title="2. Three particles" exam="NEET level"}
Masses of 1 kg, 2 kg and 1 kg sit at the points (0, 0), (4 m, 0) and (0, 4 m). Find the centre of mass.

---

$M = 4$ kg.

$X = \dfrac{1 \times 0 + 2 \times 4 + 1 \times 0}{4} = 2$ m and $Y = \dfrac{1 \times 0 + 2 \times 0 + 1 \times 4}{4} = 1$ m.

The CM is at **(2 m, 1 m)**.
:::

:::question{title="3. Shell bursts at the top" exam="JEE Main level"}
A shell fired from level ground would land 120 m away. At the top of its path it bursts into two equal pieces. One piece is left at rest just after the burst and falls straight down. Where does the other piece land? (No air resistance.)

---

Both pieces are at the top with zero vertical velocity, so they land at the **same time**. Until then only gravity (external) acts, so the CM still lands at 120 m.

The first piece falls straight down and lands at $\dfrac{120}{2} = 60$ m. For equal masses, $\dfrac{60 + x}{2} = 120$, so $x =$ **180 m** from the gun.
:::

## Torque and angular momentum

:::question{title="4. Torque as a cross product" exam="JEE Main level"}
A force $\vec F = (3\hat i + 4\hat j)$ N acts at the point $\vec r = (\hat i + 2\hat j)$ m. Find the torque about the origin.

---

$\vec\tau = \vec r\times\vec F$. Both vectors are in the $xy$-plane, so only the $\hat k$ part survives:

$\tau_z = xF_y - yF_x = 1 \times 4 - 2 \times 3 = -2$.

$\vec\tau =$ **$-2\hat k$ N m** (magnitude 2 N m, along $-z$).
:::

:::question{title="5. Moving in a straight line" exam="NEET level"}
A 0.5 kg particle moves at a steady 4 m/s along the line $y = 3$ m, in the $+x$ direction. Find its angular momentum about the origin. Does it change as the particle moves?

---

$p = 0.5 \times 4 = 2$ kg m/s. The perpendicular distance of the line from the origin is 3 m.

$l = r_\perp p = 3 \times 2 =$ **6 kg m² s⁻¹**, along $-z$ ($\vec r\times\vec p = 3\hat j\times 2\hat i = -6\hat k$). It **does not change**: $r_\perp$ and $p$ stay the same.
:::

## Moment of inertia and dynamics

:::question{title="6. Radius of gyration" exam="NEET level"}
A uniform disc of mass 2 kg and radius 0.2 m turns about its own axis (perpendicular to its plane through its centre). Find its moment of inertia and its radius of gyration.

---

$I = \tfrac12 MR^2 = \tfrac12 \times 2 \times 0.04 =$ **0.04 kg m²**.

$k = \sqrt{I/M} = \sqrt{0.02} = \dfrac{R}{\sqrt2} \approx$ **0.14 m**.
:::

:::question{title="7. Spinning up a wheel" exam="NEET level"}
A wheel with moment of inertia 2 kg m² starts from rest. A constant torque of 10 N m acts on it for 4 s. Find its final angular speed and its kinetic energy.

---

$\alpha = \dfrac{\tau}{I} = \dfrac{10}{2} = 5$ rad/s², so $\omega = \alpha t =$ **20 rad/s**.

$K = \tfrac12 I\omega^2 = \tfrac12 \times 2 \times 400 =$ **400 J**.

Check: angle turned $= \tfrac12 \times 5 \times 16 = 40$ rad, and work $= \tau\theta = 400$ J.
:::

:::question{title="8. Block on a string" exam="JEE Main level"}
A light string is wound on a uniform solid cylinder (mass 2 kg, radius 0.1 m) that can turn freely about its fixed horizontal axis. A 1 kg block hangs from the free end. Find the acceleration of the block and the tension in the string.

---

Block: $mg - T = ma$, so $10 - T = a$.

Cylinder: $TR = I\alpha = \tfrac12 MR^2 \cdot \dfrac{a}{R}$, so $T = \tfrac12 Ma = a$.

Adding: $10 = 2a$, so $a =$ **5 m/s²** and $T =$ **5 N**. (The cylinder's $\alpha = a/R = 50$ rad/s².)
:::

## Conservation and rolling

:::question{title="9. Two discs joined" exam="JEE Main level"}
A disc with $I_1 = 0.1$ kg m² spins at 30 rad/s. A second disc, $I_2 = 0.2$ kg m², at rest, is dropped onto it on the same axle. They soon turn together. Find the common angular speed and the kinetic energy lost.

---

No external torque about the axle, so $L$ is conserved: $0.1 \times 30 = (0.1 + 0.2)\,\omega$, so $\omega =$ **10 rad/s**.

$K$ before $= \tfrac12 \times 0.1 \times 900 = 45$ J. $K$ after $= \tfrac12 \times 0.3 \times 100 = 15$ J. Lost: **30 J** (as heat, by friction between the discs).
:::

:::question{title="10. Rolling down (exam extra)" exam="JEE Main level"}
A solid sphere starts from rest and rolls without slipping down a slope of vertical height 7 m. Find its speed at the bottom. (Rolling is not in the current NCERT book.)

---

For a solid sphere, $\dfrac{k^2}{R^2} = \dfrac25$. Energy is conserved (static friction does no work):

$v = \sqrt{\dfrac{2gh}{1 + 2/5}} = \sqrt{\dfrac{10gh}{7}} = \sqrt{\dfrac{10 \times 10 \times 7}{7}} =$ **10 m/s**.
:::
