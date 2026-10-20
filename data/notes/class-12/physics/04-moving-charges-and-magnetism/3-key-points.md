---
title: "Moving Charges and Magnetism: Important Points and Traps"
type: key_points
chapter: c12.physics.moving-charges-and-magnetism
order: 3
---

## Force on charges and wires

- A charge **at rest** feels no magnetic force. A moving charge feels none if it moves **along** the field.
- The magnetic force can change the direction of motion but **never the speed**. Kinetic energy stays constant, because the force does no work.
- An electric field can change the speed; a magnetic field alone cannot.

:::trap
For a **negative** charge (electron), find the direction of $\vec v \times \vec B$ and then **reverse it**. Example: $\vec v$ along $+x$, $\vec B$ along $+y$: a proton is pushed along $+z$, an electron along $-z$ (NCERT Example 4.2).
:::

:::tip
Cyclic order for unit vectors: $\hat i \times \hat j = \hat k$, $\hat j \times \hat k = \hat i$, $\hat k \times \hat i = \hat j$. Going the other way round gives a minus sign: $\hat i \times \hat k = -\hat j$.
:::

:::trap
Current is a **scalar**, even though we draw an arrow for it. The vector in $\vec F = I\,\vec l \times \vec B$ is $\vec l$.
:::

- In a uniform field, the net force on **any closed loop** is zero. A curved wire from P to Q feels the same force as a straight wire from P to Q carrying the same current (exam extra, not in NCERT).

## Circular and helical motion

:::trap
The time period $T = 2\pi m/qB$ does **not** depend on speed or radius. Doubling the speed doubles the radius, but $T$ stays the same.
:::

:::trap
In a helix, use $v_\perp = v\sin\theta$ for the **radius** and $v_\parallel = v\cos\theta$ for the **pitch**. $\theta$ is the angle between $\vec v$ and $\vec B$, not the angle with the plane perpendicular to $\vec B$.
:::

:::remember
Radius for the same field $B$:
- same speed: $r \propto m/q$;
- same momentum: $r \propto 1/q$;
- same kinetic energy: $r \propto \sqrt{m}/q$;
- same accelerating voltage: $r \propto \sqrt{m/q}$.

A proton and an alpha particle ($m$ four times, $q$ two times) with the **same kinetic energy** move on circles of the **same** radius.
:::

## Fields of currents

:::trap
There are **two** right-hand rules, and fingers and thumb swap roles:
- **straight wire:** thumb along the current, fingers give $\vec B$;
- **loop or solenoid:** fingers along the current, thumb gives $\vec B$ (and $\vec m$).
:::

- The field at a point on the line of a straight current (its extension) is **zero**.
- Field lines of $\vec B$ are always **closed loops**. Electric field lines start on $+$ charges and end on $-$ charges.
- The field of a long straight wire falls as $1/r$; on the axis far from a loop it falls as $1/x^3$.

:::trap
In $B = \mu_0 nI$, $n$ is turns **per metre**, not the total number of turns. For several layers, add up all the turns before dividing by the length (NCERT Exercise 4.8 has 5 layers of 400 turns: $n = 2000/0.8$ per metre).
:::

:::trap
In the arc formula $B = \dfrac{\mu_0 I\phi}{4\pi R}$, $\phi$ must be in **radians**. A quarter circle is $\phi = \pi/2$, so $B = \mu_0 I/8R$.
:::

- Inside a thick wire, $B$ grows with $r$; outside, it falls as $1/r$. It is largest at the surface and zero on the axis.
- Exam extra (not in NCERT): inside a long **hollow** pipe with current along its length, $B = 0$ (an Amperian circle inside encloses no current).
- The field inside a long solenoid does not depend on its radius or on where you are inside (away from the ends).

## Ampere's law

:::remember
Ampere's law holds for **every** closed loop, but it only gives $B$ easily when there is symmetry. NCERT notes that it cannot give the simple field $\mu_0 I/2R$ at the centre of a circular loop; use Biot-Savart there.
:::

- Only the current **enclosed** by the loop appears on the right side. Currents outside still create field on the loop, but their line integral adds to zero.
- The law in this chapter is for **steady** currents only.

## Parallel currents

:::trap
**Like currents attract**, but like charges repel. Do not copy the electrostatic rule.
:::

- Doubling both currents makes the force 4 times. Doubling the distance halves it ($F \propto 1/d$, not $1/d^2$).
- Exam extra (not in NCERT): two parallel electron beams still **repel**. Their electric repulsion is larger than their magnetic attraction (the ratio of magnetic to electric force is $v^2/c^2$).

:::remember
NCERT defines the ampere by the force $2 \times 10^{-7}$ N/m between wires 1 m apart (adopted in 1946). Write this definition in exams. (Beyond the syllabus: since 2019 the SI fixes the ampere through the value of $e$.)
:::

## Torque and the magnetic dipole

:::trap
In $\tau = NIAB\sin\theta$, $\theta$ is between $\vec B$ and the **normal** to the coil, not the plane. When the **plane** is along $\vec B$, $\theta = 90^\circ$ and the torque is **largest**.
:::

- The torque depends only on the **area**, not the shape. A square and a circle of equal area, same $N$, $I$ and $B$, feel the same torque (NCERT Exercise 4.13).
- For a fixed length of wire, a circle encloses the most area, so it gives the largest $m$. A flexible loop in a field pulls itself into a circle (NCERT Example 4.11).
- Stable equilibrium: $\vec m$ along $\vec B$. Then the loop's own field adds to the external field, and the total flux through it is largest.
- A loop lying flat on a table cannot be made to spin about the vertical by any uniform field: $\vec\tau = \vec m \times \vec B$ always lies in the plane of the loop.

:::tip
Electric dipole to magnetic dipole: swap $\vec p \to \vec m$, $\vec E \to \vec B$ and $1/\varepsilon_0 \to \mu_0$. Torque $\vec p \times \vec E$ becomes $\vec m \times \vec B$; the axial field $2p/(4\pi\varepsilon_0 x^3)$ becomes $\mu_0 2m/(4\pi x^3)$.
:::

## Galvanometer, ammeter, voltmeter

:::remember
**S**hunt in **para**llel makes an **ammeter** (small $r_s$). **Ser**ies with a large **R** makes a **voltmeter**. Ideal ammeter: zero resistance. Ideal voltmeter: infinite resistance.
:::

:::trap
More turns raise the **current** sensitivity, but **not** the voltage sensitivity, because $R_G$ rises with the length of wire too.
:::

- The ammeter's resistance is **less than** the shunt itself (two resistors in parallel).
- The soft iron core does two jobs: it makes the field **radial** and **stronger**.
- The radial field keeps $\sin\theta = 1$, so the deflection is proportional to the current and the scale is uniform.

## NCERT lines to know

:::remember
- Moving charges or currents produce a magnetic field (Oersted, 1820).
- The magnetic force $q(\vec v \times \vec B)$ is normal to $\vec v$ and does no work.
- Parallel currents attract, and antiparallel currents repel.
- Magnetic monopoles are not known to exist; the current loop is the most elementary magnetic element.
:::
