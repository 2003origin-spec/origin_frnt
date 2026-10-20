---
title: "Electromagnetic Induction: Important Points and Traps"
type: key_points
chapter: c12.physics.electromagnetic-induction
order: 3
---

## Flux and Faraday's law

:::trap
In $\Phi_B = BA\cos\theta$, $\theta$ is the angle between $\vec B$ and the **normal** to the coil, not the plane of the coil. "Plane at 30° to the field" means $\theta = 60^\circ$.
:::

:::trap
The emf depends on how fast the flux **changes**, not on how large it is. A loop held still between very strong magnets has a large flux but **no** emf (NCERT Example 6.5).
:::

- Flux is maximum when the emf is zero, and zero when the emf is maximum (rotating coil). Don't mix them up.
- Turning a coil that starts **face-on** to the field ($\theta = 0$) through 180° changes the flux by $2BA$, not zero: it goes from $+BA$ to $-BA$. (A coil that starts with its plane along the field and turns 180° has zero net change.)
- Units: 1 Wb = 1 T m², and 1 T = 1 Wb m⁻². Also 1 G (gauss) $= 10^{-4}$ T.
- Use the **total** change in flux linkage, $N\Delta\Phi$, for a coil of $N$ turns.

:::remember
- A changing **electric** flux does **not** induce a current in a loop (NCERT Example 6.5).
- A loop sliding (not rotating) **wholly inside** a uniform field, or wholly outside it, has **no** induced current. Current flows only while it is entering or leaving (NCERT Example 6.4).
:::

- A **rectangular** loop leaving a uniform field at constant speed gives a **constant** emf. A **circular** loop gives a varying emf, because its area leaves at a varying rate.

## Lenz's law

:::remember
Lenz's law follows from **conservation of energy**. The induced current always makes it harder to cause the change, so work must be done, and that work becomes heat.
:::

:::trap
Lenz's law opposes the **change** in flux, not the flux itself. If the flux is **decreasing**, the induced current tries to **keep it up**, so its field is in the **same** direction as the original field.
:::

:::tip
**Approaching N sees N; leaving N sees S.** The face of the coil towards the magnet copies the approaching pole (repel) and is opposite to a leaving pole (attract). Either way the coil resists the motion.
:::

- A magnet dropped through a horizontal closed ring falls with acceleration **less than $g$**, both while approaching and while leaving the ring. With a cut in the ring there is no current, so it falls freely.
- Seen from the magnet's side, an approaching N-pole gives an **anticlockwise** current; a receding N-pole gives a **clockwise** one.

## Motional emf

:::trap
$\varepsilon = Blv$ needs the rod, its velocity and $\vec B$ all at right angles. A rod moving **along its own length**, or moving **parallel to $\vec B$**, has **no** emf.
:::

- Find which end is positive with $\vec F = q\vec v\times\vec B$: positive charges are pushed to one end, which becomes the **higher-potential** end.
- A rod rotating about one end: $\tfrac12 B\omega R^2$. Use $\omega$ in rad/s; convert rev/s with $\omega = 2\pi\nu$.
- (Beyond the syllabus aid) A rod rotating about its **centre** has zero emf between its two ends: the two halves give equal and opposite emfs.

:::remember
The number of spokes in a rotating wheel does **not** change the emf between axle and rim. The spokes are in parallel (NCERT Example 6.7).
:::

## Inductance

:::trap
$L$ and $M$ depend only on the **geometry** and the **medium**, like capacitance. Doubling the current does **not** change $L$; it doubles the flux linkage.
:::

- $L = \mu_0 n^2 A l = \mu_0 N^2 A/l$. Read the question: $n$ is turns per **metre**, $N$ is the **total** number of turns. Keeping $l$ and $A$ fixed, doubling $N$ makes $L$ **four** times.
- $M_{12} = M_{21}$ always, even for coils of very different shapes.
- For coaxial solenoids use the area of the **inner** one in $M$.
- $M$ depends on the distance and orientation of the coils. (Exam extra) Two coils with their axes perpendicular have very small $M$; $M \le \sqrt{L_1L_2}$.
- The back emf opposes the **change** in current, not the current. When the current is falling, the back emf tries to keep it flowing.

:::remember
- Self-inductance plays the role of **inertia**; it is the electromagnetic analogue of mass.
- Energy stored $= \tfrac12 LI^2$, like $\tfrac12 mv^2$.
- Energy density $B^2/2\mu_0$, like $\tfrac12\varepsilon_0E^2$ for an electric field.
- Unit of inductance: henry (H). Dimensions $[\text{M L}^2\text{T}^{-2}\text{A}^{-2}]$, same for $L$ and $M$.
:::

- (Beyond the syllabus aid) The current through an inductor cannot change **suddenly**, since that would need an infinite back emf. Just after switching on, an inductor that carried no current acts like an open switch; a long time later, an ideal (zero-resistance) inductor acts like a plain wire.

## AC generator

:::trap
NCERT's $\varepsilon = NBA\omega\sin\omega t$ assumes the coil's plane is **perpendicular** to $\vec B$ at $t = 0$ (flux maximum). If the plane starts parallel to $\vec B$, the emf is $NBA\omega\cos\omega t$; the peak is the same.
:::

- Peak emf $NBA\omega$ grows with turns, field, area and speed of rotation.
- Rotation in rpm: divide by 60 to get rev/s, then $\omega = 2\pi\nu$.
- The generator turns mechanical energy into electrical energy. It does **not** create energy.
- Slip rings keep the output alternating. (A split-ring commutator would give dc; that is not in this chapter.)

## Eddy currents (exam extra: in both syllabi, not in NCERT)

- Currents induced inside a solid metal by a changing flux. They heat the metal and oppose motion.
- Reduced by **laminating** the core (thin insulated sheets) or cutting slots in a metal plate.
- Useful in: magnetic brakes in trains, electromagnetic damping, induction furnaces, electric power meters.

## NCERT lines to know

:::remember
- The phenomenon in which electric current is generated by varying magnetic fields is called **electromagnetic induction**.
- Magnetic flux is a **scalar**; its SI unit is the weber.
- Inductance is the ratio of the **flux linkage** to the current, $N\Phi/I$.
- The frequency of ac in India is **50 Hz**.
:::
