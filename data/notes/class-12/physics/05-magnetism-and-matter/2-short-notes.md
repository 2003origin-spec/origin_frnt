---
title: "Magnetism and Matter: Short Notes"
type: short_notes
chapter: c12.physics.magnetism-and-matter
order: 2
---

## 1. Basic facts

- The earth behaves like a magnet. Its field points roughly from geographic **south to north**.
- A freely hung bar magnet points north–south. The end that points to geographic north is the **north pole**.
- Like poles repel, unlike poles attract.
- Poles can't be separated. Break a magnet and you get two smaller magnets, each with N and S. Isolated poles (**magnetic monopoles**) are not known to exist.
- Magnets can be made from iron and its alloys.

## 2. Magnetic field lines

Iron filings around a bar magnet (or a current-carrying solenoid) show the field-line pattern. It looks like the field of an electric dipole, so a bar magnet is a **magnetic dipole**.

- They form **continuous closed loops**: outside the magnet from N to S, inside it from S to N.
- The **tangent** at a point gives the direction of $\vec B$ there.
- The more lines cross a unit area, the stronger $B$.
- Two lines never **cross**, otherwise $\vec B$ would have two directions at one point.
- A compass needle placed at different points traces them out.

:::remember
NCERT avoids the name "magnetic lines of force". The magnetic force on a moving charge, $q\vec v\times\vec B$, is **perpendicular** to $\vec B$, so the lines do not show the direction of that force.
:::

**Electric vs magnetic field lines**

| | Electric (dipole) | Magnetic |
| --- | --- | --- |
| Start and end | On charges, or go to infinity | Never: closed loops |
| Closed loops? | Never | Always |
| Tangent shows | Force on a + charge | Way a compass needle points, not the force on a moving charge |

## 3. Bar magnet as an equivalent solenoid

- A current loop is a magnetic dipole (Chapter 4). **Ampere's hypothesis:** all magnetism comes from circulating currents.
- A bar magnet acts like a solenoid: many circulating currents side by side. Cutting either in two gives two weaker ones.
- Far along the axis, a finite solenoid gives $B = \dfrac{\mu_0}{4\pi}\dfrac{2m}{r^3}$, the same as a bar magnet.
- So the magnetic moment of a bar magnet equals that of the solenoid that gives the same field, $m = NIA$.

## 4. A magnet in a uniform field

- **Torque** $\vec\tau = \vec m\times\vec B$, size $mB\sin\theta$. It tries to line $\vec m$ up with $\vec B$ (a restoring torque).
- **Net force is zero**, because the forces on the two ends are equal and opposite.
- **Potential energy** $U = -\vec m\cdot\vec B$, taking $U = 0$ at $\theta = 90^\circ$.

| $\theta$ | $U$ | Equilibrium |
| --- | --- | --- |
| $0^\circ$ ($\vec m$ along $\vec B$) | $-mB$ (least) | Stable |
| $90^\circ$ | $0$ | None: torque is largest |
| $180^\circ$ ($\vec m$ against $\vec B$) | $+mB$ (most) | Unstable |

**Non-uniform field:** now there is a net force too. An iron nail near a magnet becomes a magnet itself (induced moment). Its induced pole nearer the magnet is the unlike one, so the attraction wins and the nail is pulled in (NCERT Example 5.1).

**Two small needles (NCERT Example 5.2):** needle Q sits in the field $\vec B_P$ of needle P. Q is in stable equilibrium when $\vec m_Q$ is parallel to $\vec B_P$, and unstable when antiparallel.

## 5. The electrostatic analog

The far field, torque and energy of a bar magnet come from the electric-dipole results by changing $\vec E \to \vec B$, $\vec p \to \vec m$ and $\dfrac{1}{4\pi\varepsilon_0} \to \dfrac{\mu_0}{4\pi}$.

| Quantity | Electric dipole | Bar magnet |
| --- | --- | --- |
| Moment | $\vec p$ | $\vec m$ |
| Torque | $\vec p\times\vec E$ | $\vec m\times\vec B$ |
| Energy | $-\vec p\cdot\vec E$ | $-\vec m\cdot\vec B$ |

Axial field (short dipole, $r \gg l$), along the moment:
$$B_A = \frac{\mu_0}{4\pi}\,\frac{2m}{r^3}$$
Equatorial field, opposite to the moment:
$$B_E = \frac{\mu_0}{4\pi}\,\frac{m}{r^3}$$

## 6. Gauss's law for magnetism

:::remember
The net magnetic flux through **any closed surface** is zero: $\sum \vec B\cdot\Delta\vec S = 0$.
:::

- As many field lines leave a closed surface as enter it, because the lines are closed loops.
- Compare electrostatics: $\sum \vec E\cdot\Delta\vec S = q/\varepsilon_0$. The difference is that there are no magnetic monopoles, so $\vec B$ has no sources or sinks.
- The simplest magnetic element is a **dipole** (or a current loop).
- If monopoles existed, the right side would be $\mu_0 q_m$, where $q_m$ = magnetic charge enclosed (NCERT Example 5.4).
- A system with **zero net charge** can still have a magnetic moment, as atoms of a paramagnet do.

## 7. Magnetisation and magnetic intensity

- Electrons going round in atoms give magnetic moments. In a bulk sample they add as vectors.
- **Magnetisation** $\vec M$ = net magnetic moment per unit volume (A m⁻¹).
- In a long solenoid with an empty core, $B_0 = \mu_0 nI$. Filling it with a magnetised material adds $B_m = \mu_0 M$, so $B = B_0 + B_m$.
- **Magnetic intensity** $\vec H = \vec B/\mu_0 - \vec M$ (A m⁻¹). So $\vec B = \mu_0(\vec H + \vec M)$.
- $H$ is the part set by **outside causes** (the current; $H = nI$ in a solenoid). $M$ is the part from the **material**, and it depends on $H$.

:::example{title="Solenoid with a core (NCERT Example 5.5)"}
$n = 1000$ turns/m, $I = 2$ A, $\mu_r = 400$. $H = nI = 2\times10^3$ A/m. $B = \mu_r\mu_0 H \approx 1.0$ T. $M = (\mu_r - 1)H \approx 8\times10^5$ A/m. The magnetising current is $I_M = (\mu_r - 1)I = 399 \times 2 = 798$ A. NCERT's answer, 794 A, comes from using the rounded value $B = 1.0$ T in $B = \mu_0 n(I + I_M)$; both are fine. (The book prints $\mu_r$ in that relation; it should be $\mu_0$.)
:::

## 8. Susceptibility and permeability

- **Susceptibility** $\chi$: $\vec M = \chi\vec H$. It measures how strongly a material responds to an outside field. No unit.
- **Relative permeability** $\mu_r = 1 + \chi$ (no unit). It plays the role of the dielectric constant in electrostatics.
- **Permeability** $\mu = \mu_0\mu_r$, and $\vec B = \mu\vec H$.
- $\chi$ small and positive: paramagnetic. Small and negative: diamagnetic ($\vec M$ opposite to $\vec H$). Large and positive: ferromagnetic.

## 9. Dia-, para- and ferromagnetism

| | Dia | Para | Ferro |
| --- | --- | --- | --- |
| $\chi$ | Small, negative | Small, positive | Large, positive |
| In a magnet's field | Weakly repelled | Weakly attracted | Strongly attracted |
| Moves towards | Weaker field | Stronger field | Stronger field |
| Field lines inside | Pushed out | Drawn in a little | Crowd in strongly |

**Diamagnetism**
- Atoms have **no net** magnetic moment.
- In a field, electron orbits whose moment is along the field slow down; opposite ones speed up (Lenz's law, Chapter 6). The net induced moment is **opposite** to the field, so the material is repelled.
- The field inside drops slightly (about 1 part in $10^5$).
- Examples: bismuth, copper, lead, silicon, nitrogen (at STP), water, sodium chloride.
- Diamagnetism is present in **all** substances, but it is hidden when para- or ferromagnetism is present.
- **Superconductors** (metals at very low temperature) are perfect diamagnets: $\chi = -1$, $\mu_r = 0$. The field is pushed out completely: the **Meissner effect**. Used in magnetically levitated trains.

**Paramagnetism**
- Each atom (ion, molecule) has a **permanent** magnetic moment, but random thermal motion keeps them pointing every way, so there is no net magnetisation.
- A strong field and a low temperature line them up along the field. The field inside rises slightly (about 1 part in $10^5$).
- $\chi$ and $\mu_r$ depend on the temperature. Raising the field or lowering $T$ increases $M$ until it **saturates** (all dipoles aligned).
- Examples: aluminium, sodium, calcium, oxygen (at STP), copper chloride.

**Ferromagnetism**
- Atomic moments line up **with each other** on their own over regions called **domains** (about 1 mm across, about $10^{11}$ atoms). Explaining why needs quantum mechanics.
- With no field, the domains point randomly and there is no bulk magnetisation.
- In a field, domains turn towards it and the aligned ones **grow**. They can merge into one "giant" domain.
- Domains are real: they can be seen under a microscope with a liquid suspension of ferromagnetic powder.
- $\mu_r$ is above 1000. Examples: iron, cobalt, nickel, gadolinium.
- **Hard** ferromagnets keep their magnetisation when the field is removed: alnico (Fe, Al, Ni, Co, Cu) and lodestone. Used for permanent magnets, such as a compass needle.
- **Soft** ferromagnets lose it when the field is removed: soft iron.

## 10. Effect of temperature

- **Paramagnets:** the hotter the sample, the more the thermal motion jumbles the dipoles, so $\chi$ falls. (Exam extra, not in NCERT: Curie's law, $\chi \propto 1/T$.)
- **Ferromagnets:** at a high enough temperature the domain structure breaks up and the material becomes **paramagnetic**. The magnetisation disappears gradually. (Exam extra, not in NCERT: this temperature is the **Curie temperature** $T_C$.)
- **Diamagnets** (exam extra, not in NCERT): $\chi$ hardly changes with temperature.

Other kinds exist (ferrimagnetic, antiferromagnetic, spin glass). NCERT only names them.
